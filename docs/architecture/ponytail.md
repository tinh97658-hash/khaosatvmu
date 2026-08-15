# Ponytail AI Coding Ruleset

Official Repository: [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail)

Ponytail là bộ quy tắc / skill chính thức dành cho AI Coding Agent dựa trên triết lý **"Laziest Senior Developer"** (Lập trình viên kỳ cựu tối giản).
Mục tiêu là giảm thiểu code thừa (~54% ít code hơn), tiết kiệm token, tăng tốc độ xử lý và duy trì tính an toàn của hệ thống.

---

## 🚀 Cài Đặt (Plugin Marketplace)

Đối với các hệ thống AI Agent có hỗ trợ Plugin Marketplace (như Claude Code, Codex, Copilot CLI...):

```bash
# Bước 1: Thêm Marketplace
/plugin marketplace add DietrichGebert/ponytail

# Bước 2: Cài đặt Plugin
/plugin install ponytail@ponytail
```

---

## 🪜 Thang Quyết Định Chính Thức (The Decision Ladder)

Trước khi tạo hoặc chỉnh sửa bất kỳ dòng code nào, AI bắt buộc phải đánh giá theo 7 bước sau và dừng lại ngay ở bước đầu tiên thỏa mãn:

1. **Need (YAGNI):** Đoạn code/tính năng này có thực sự cần tồn tại không? Nếu không, bỏ qua.
2. **Codebase Reuse:** Đã có helper, utility, component hay type nào giải quyết việc này trong dự án chưa?
3. **Stdlib:** Thư viện chuẩn của ngôn ngữ có xử lý được không?
4. **Native Platform Feature:** Trình duyệt / Nền tảng có tính năng gốc xử lý được không? (Ví dụ: `<input type="date">` thay vì date-picker rườm rà).
5. **Installed Dependency:** Các thư viện đã cài trong `package.json` có giải quyết được không?
6. **One-Liner:** Có thể viết thành 1 dòng gọn gàng được không?
7. **Minimal Implementation:** Nếu phải viết mới, chỉ viết lượng code tối thiểu cần thiết để vận hành.

---

## 🎚️ Chế Độ Hoạt Động (Intensity Levels)

- `/ponytail lite`: Cân bằng giữa đơn giản và mở rộng.
- `/ponytail full` *(Default)*: Áp dụng nghiêm ngặt Thang quyết định.
- `/ponytail ultra`: Tối giản hóa tối đa, ưu tiên one-liner.

---

## 🛡️ Nguyên Tắc An Toàn & Chất Lượng

- **Không bỏ qua an toàn:** Không đánh đổi Validation, Type Safety, Security, Error Handling hay Accessibility.
- **Tối giản thiết kế, nghiêm ngặt thực thi.**
- **Không dùng raw SQL trong `Program.cs`.**
- **Đổi schema/database phải thông qua EF migration.**
- **Không tự ý xóa file bừa bãi.**
- **Không viết code dài dòng, lan man, thừa thãi.**
- **Không sửa file ngoài phạm vi task nếu không có lý do rõ ràng.**
- **Không thêm abstraction nếu nó không giải quyết được độ phức tạp thật.**
- **Không trộn thay đổi frontend và backend nếu task không yêu cầu.**
- **Không tái sử dụng một API cho các chức năng riêng biệt hoặc không liên quan.**
