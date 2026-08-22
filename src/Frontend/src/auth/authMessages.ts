const messages: Record<string, string> = {
  AUTH_USER_NOT_REGISTERED: 'Tài khoản chưa được cấp quyền sử dụng hệ thống.',
  AUTH_ACCOUNT_DISABLED: 'Tài khoản đã bị vô hiệu hóa.',
  AUTH_EMAIL_NOT_VERIFIED: 'Địa chỉ email Google chưa được xác minh.',
  AUTH_NO_PROFILE: 'Bạn chưa được cấp hồ sơ làm việc hợp lệ.',
  AUTH_PROFILE_DISABLED: 'Hồ sơ làm việc đã bị vô hiệu hóa.',
  AUTH_SESSION_EXPIRED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  AUTH_ACCOUNT_LINK_CONFLICT: 'Thông tin liên kết Google không khớp với tài khoản hệ thống.',
  AUTH_GOOGLE_REMOTE_FAILURE: 'Google không thể hoàn tất đăng nhập. Vui lòng thử lại.',
  AUTH_GOOGLE_NOT_CONFIGURED: 'Đăng nhập Google hiện chưa được cấu hình.',
  AUTH_CSRF_INVALID: 'Phiên bảo mật không còn hợp lệ. Vui lòng tải lại trang.',
  AUTH_API_UNAVAILABLE: 'Không thể kết nối tới máy chủ xác thực.',
  AUTH_REQUEST_FAILED: 'Yêu cầu xác thực không thành công.',
};

export function authMessage(errorCode: string | null): string | null {
  if (!errorCode) {
    return null;
  }

  return messages[errorCode] ?? 'Đã xảy ra lỗi xác thực. Vui lòng thử lại.';
}
