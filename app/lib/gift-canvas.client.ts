import { Canvas, FabricImage, Group, Path, Textbox } from "fabric";
import { GIFT_PREVIEW_MAX, GIFT_PREVIEW_PX } from "./config";
import type { LayoutItem } from "./gift";

/**
 * Canvas giỏ quà (Fabric 7). Chỉ trang /gift tải module này, bằng `import()` động trong useEffect:
 * không route nào khác có Fabric trong chunk, server không bao giờ chạy nó.
 * Toạ độ logic là khung vuông SIZE×SIZE; CSS co giãn theo bề rộng màn hình (Fabric tự quy đổi toạ độ chạm).
 */
const SIZE = 400;
const ITEM = 120; // cạnh dài của một món khi mới thêm (s = 1)
const RATTAN = "#B9874B";
const RATTAN_DARK = "#8A5F2E";
const RATTAN_LIGHT = "#D9AE73";
const INK = "#1F1E1C"; // = --color-ink trong app.css
const SELECT = "#1F1E1C"; // khung chọn món: mực đen như mọi đường viền khác

export type GiftCanvas = {
  /** Thêm một món (uid do React cấp) ở vị trí so le trong lòng giỏ, rồi chọn nó để kéo/xoay ngay. */
  add(uid: number, pid: number, src: string): Promise<void>;
  remove(uid: number): void;
  setMessage(text: string): void;
  /** Layout gửi server: mỗi món một phần tử, toạ độ tâm 0–1, s so với cỡ lúc thêm, r độ. */
  layout(): LayoutItem[];
  /** Ảnh xem trước webp ≤60KB, cạnh ≤480px (Safari không mã hoá webp: jpeg). Ném lỗi nếu không ép được dưới trần. */
  preview(): string;
  dispose(): Promise<void>;
};

// Vỏ giỏ vẽ bằng path (không cần ảnh vỏ giỏ tách nền): quai + miệng sau nằm dưới các món, thân trước nằm trên,
// nên món trông như đặt trong lòng giỏ. Cả hai không bắt sự kiện chuột/chạm.
// Vân mây: 5 hàng nét đứt so le (trên/dưới) + 9 nan dọc theo độ thuôn của thân, vành có viền sáng (cổng UI M4 F5).
const HANDLE = "M 78 236 C 70 40, 330 40, 322 236";
const RIM = "M 26 250 C 26 274, 374 274, 374 250";
const basketBack = () =>
  new Group(
    [
      new Path("M 50 388 A 150 10 0 1 0 350 388 A 150 10 0 1 0 50 388 Z", { fill: "rgba(42,27,61,.08)" }), // bóng dưới đáy
      new Path(HANDLE, { fill: "", stroke: RATTAN, strokeWidth: 16, strokeLineCap: "round" }),
      new Path(HANDLE, { fill: "", stroke: RATTAN_LIGHT, strokeWidth: 4, strokeLineCap: "round", strokeDashArray: [18, 10] }),
      new Path("M 30 250 C 30 222, 370 222, 370 250 C 370 270, 30 270, 30 250 Z", { fill: RATTAN_DARK }),
    ],
    { selectable: false, evented: false },
  );
const basketFront = () =>
  new Group(
    [
      new Path(`${RIM} L 334 372 C 330 390, 70 390, 66 372 Z`, { fill: RATTAN }),
      ...Array.from({ length: 9 }, (_, i) => {
        const [top, bottom, t] = [40 + i * 40, 70 + i * 32.5, i / 8]; // vành 40..360 → đáy 70..330 (đáy cong: y theo bezier)
        return new Path(`M ${top} 268 L ${bottom} ${370 + 54 * t * (1 - t)}`, { fill: "", stroke: RATTAN_DARK, strokeWidth: 2, opacity: 0.45 });
      }),
      ...[282, 302, 322, 342, 362].map(
        (y, i) =>
          new Path(`M ${36 + (y - 250) / 3} ${y} L ${364 - (y - 250) / 3} ${y}`, {
            fill: "",
            stroke: RATTAN_DARK,
            strokeWidth: 4,
            strokeDashArray: [14, 6],
            strokeDashOffset: i % 2 ? 10 : 0,
          }),
      ),
      new Path(RIM, { fill: "", stroke: RATTAN_DARK, strokeWidth: 10 }),
      new Path("M 26 246 C 26 270, 374 270, 374 246", { fill: "", stroke: RATTAN_LIGHT, strokeWidth: 2 }),
    ],
    { selectable: false, evented: false },
  );

// Điều khiển: chỉ góc (phóng to giữ tỉ lệ) + núm xoay; vùng chạm 44px trên màn cảm ứng (spec: ≥44px)
const CONTROL_STYLE = {
  cornerColor: SELECT,
  borderColor: SELECT,
  cornerStrokeColor: "#FFFFFF",
  cornerStyle: "circle" as const,
  transparentCorners: false,
  cornerSize: 16,
  touchCornerSize: 44,
  lockScalingFlip: true,
  minScaleLimit: 0.05,
};

const FILL_X = [0.5, 0.36, 0.64, 0.24, 0.76];

export async function createGiftCanvas(host: HTMLElement): Promise<GiftCanvas> {
  const el = document.createElement("canvas"); // canvas riêng mỗi lần: StrictMode chạy effect 2 lần không đụng canvas đã khởi tạo
  host.append(el);
  const canvas = new Canvas(el, {
    width: SIZE,
    height: SIZE,
    backgroundColor: "#FFFFFF",
    preserveObjectStacking: true, // chọn món không đưa nó lên trên cùng (che lời chúc)
    selection: false, // không kéo vùng chọn nhiều món
    backgroundImage: basketBack(),
    overlayImage: basketFront(),
  });
  canvas.setDimensions({ width: "100%", height: "100%" }, { cssOnly: true });

  const items = new Map<number, { obj: FabricImage; pid: number; base: number }>();
  const wanted = new Set<number>(); // uid đang chờ ảnh tải: bị xoá trước khi tải xong thì không thêm nữa
  let text: Textbox | null = null;
  // Món không kéo được ra ngoài hay chìm hẳn dưới thân trước (overlay): ảnh xem trước thiếu món mà đơn vẫn tính tiền.
  // Tâm y ≤ 285 giữ ít nhất 1/3 trên của món 120px nổi trên vành (cổng UI M4 F2). Lời chúc không bị giới hạn.
  canvas.on("object:moving", ({ target }) => {
    if (target === text) return;
    target.set({ left: Math.min(372, Math.max(28, target.left)), top: Math.min(285, Math.max(40, target.top)) });
  });

  return {
    async add(uid, pid, src) {
      wanted.add(uid);
      const img = await FabricImage.fromURL(src);
      if (!wanted.has(uid) || canvas.disposed) return;
      const base = ITEM / Math.max(img.width, img.height);
      const n = items.size;
      img.set({
        ...CONTROL_STYLE,
        scaleX: base,
        scaleY: base,
        left: SIZE * FILL_X[n % 5], // từ giữa ra hai bên, nằm trong lòng giỏ (không đậu trên vành)
        top: SIZE * (Math.floor(n / 5) % 2 ? 0.5 : 0.56),
        angle: (n % 3) * 8 - 8,
      });
      img.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
      items.set(uid, { obj: img, pid, base });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
    },
    remove(uid) {
      wanted.delete(uid);
      const item = items.get(uid);
      if (!item) return;
      items.delete(uid);
      canvas.remove(item.obj);
      canvas.requestRenderAll();
    },
    setMessage(message) {
      if (!message.trim()) {
        if (text) canvas.remove(text);
        text = null;
      } else if (text) {
        text.set({ text: message });
      } else {
        // Gốc trên (Fabric 7 mặc định tâm): dòng mới mọc xuống dưới, không tràn khỏi mép trên (cổng UI M4 F1).
        // objectCaching tắt: chỉ một object chữ, vẽ thẳng mỗi lần, không có ảnh đệm cũ sau khi xuống dòng lại.
        text = new Textbox(message, {
          originY: "top",
          left: SIZE / 2,
          top: 12,
          width: SIZE - 60,
          fontSize: 20,
          objectCaching: false,
          lineHeight: 1.3, // ≥1.1: dấu chồng (ẫ, ặ) không bị cắt
          fontFamily: "Archivo Variable", // font chữ thường của trang, chắc chắn đã tải
          fill: INK,
          textAlign: "center",
          editable: false, // gõ ở textarea bên ngoài (bàn phím và trình đọc màn hình dùng được)
          hasControls: false,
          borderColor: SELECT,
        });
        canvas.add(text);
      }
      canvas.requestRenderAll();
    },
    layout() {
      const round = (v: number) => Math.round(v * 1000) / 1000;
      return [...items.values()].map(({ obj, pid, base }) => {
        const c = obj.getCenterPoint();
        return {
          pid,
          x: round(Math.min(1, Math.max(0, c.x / SIZE))),
          y: round(Math.min(1, Math.max(0, c.y / SIZE))),
          s: round(Math.min(5, Math.max(0.2, obj.scaleX / base))),
          r: round(((obj.angle % 360) + 360) % 360),
        };
      });
    },
    preview() {
      canvas.discardActiveObject(); // không chụp khung chọn và núm điều khiển
      canvas.renderAll();
      for (const [px, quality] of [[GIFT_PREVIEW_PX, 0.8], [GIFT_PREVIEW_PX, 0.6], [360, 0.6], [360, 0.4]] as const) {
        let url = canvas.toDataURL({ format: "webp", quality, multiplier: px / SIZE });
        // Safari không mã hoá webp (trả PNG): dùng jpeg, nền trắng nên không mất gì
        if (!url.startsWith("data:image/webp")) url = canvas.toDataURL({ format: "jpeg", quality, multiplier: px / SIZE });
        if (url.length <= GIFT_PREVIEW_MAX) return url;
      }
      throw new Error("Ảnh xem trước quá lớn");
    },
    async dispose() {
      wanted.clear();
      await canvas.dispose();
      el.remove();
    },
  };
}
