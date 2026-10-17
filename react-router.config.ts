import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  // Bắt buộc cho giỏ (spike M2, mục 11): chế độ lazy bắt lần submit /cart đầu tiên chờ /__manifest trước khi
  // đăng ký AbortController, nên lần bấm thứ hai không huỷ được nó và một dòng có thể bị ghi đè mất.
  routeDiscovery: { mode: "initial" },
} satisfies Config;
