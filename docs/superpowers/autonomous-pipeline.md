# Quy trình tự vận hành M2–M7

Chủ dự án yêu cầu (15/10/2026): các agent tự lên kế hoạch, tự làm, tự đánh giá; chủ dự án chỉ kiểm tra kết quả cuối. Controller (phiên Claude chính) chỉ điều phối và ra ruling. Mọi ruling được ghi vào ledger và roadmap.

## Vai trò (theo hội đồng ở `docs/council/`)

| Vai | Agent | Việc |
|---|---|---|
| Developer (planner) | 1 agent / milestone | Đọc spec + roadmap (mục "Kết quả Mx") + code hiện có, chạy spike kiểm API, viết plan chi tiết theo `superpowers:writing-plans` |
| Consultant (plan gate) | 1 agent / milestone | Duyệt plan theo spec; planner sửa đến khi đạt |
| Developer (implementer) | 1 agent / task | Làm đúng brief, TDD, báo cáo |
| Developer (reviewer) | 1 agent / task | Review spec + chất lượng trên diff |
| Designer + Customer | 1 agent / milestone có UI | Đánh giá ảnh chụp 375px và desktop, theo nhãn quan của từng vai |
| Consultant (milestone gate) | 1 agent / milestone | Review toàn milestone, phân loại việc dồn, quyết "đạt / sửa" |

## Luật chung

- Spec là nguồn sự thật, plan là lập luận của spec. Xung đột giữa hai bên thì controller ra ruling.
- Không git trong project. Diff cho review lấy từ repo bóng ở scratchpad.
- Không bao giờ: `prisma migrate reset`, `docker compose down -v`, xoá cả thư mục `uploads/`, thêm dependency ngoài spec.
- Mỗi milestone kết thúc bằng mục "Kết quả Mx" trong roadmap.
- Cuối cùng có `docs/report.html` tổng hợp quá trình từ FE tới BE cho chủ dự án.

## Chỉ dừng lại hỏi chủ dự án khi

Gặp thao tác không đảo ngược được, thao tác nhạy cảm bảo mật, việc ảnh hưởng ra ngoài máy, hoặc plan hỏng tới mức mọi hướng đều là đoán.
