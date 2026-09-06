/**
 * Bỏ dấu tiếng Việt và hạ chữ thường, để so chuỗi không phụ thuộc kiểu đặt dấu.
 *
 * Cùng một tên có thể ra hai chuỗi ký tự khác hẳn nhau vì hai lý do:
 * - Kiểu đặt dấu: "thuỷ" và "thủy", "hoà" và "hòa", "khoẻ" và "khỏe".
 * - Ký tự dựng sẵn hay ký tự ghép: "ủ" là một mã, hoặc "u" cộng dấu hỏi rời.
 *
 * Người dùng gõ bằng bộ gõ nào thì ra kiểu ấy, nên tìm kiếm mà so thẳng là trượt.
 * Bỏ dấu đi thì cả hai kiểu về chung một chuỗi. Đây là bản sao của
 * `NormalizeLooseKey` bên backend — hai nơi phải cho ra cùng kết quả.
 */
export function foldVietnamese(value: string): string {
  return value
    .normalize('NFD')
    // Dấu thanh sau khi tách ra nằm trong dải U+0300..U+036F.
    .replace(/[̀-ͯ]/g, '')
    // đ/Đ là chữ cái riêng, không tách ra dấu nên phải đổi tay.
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .trim()
    .toLowerCase();
}
