export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

/** Authアカウントに設定するパスワードの共通検証。 */
export function validateAccountPassword(password: string) {
  if (!password) return "パスワードを入力してください";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `パスワードは${MAX_PASSWORD_LENGTH}文字以内で入力してください`;
  }
  return null;
}

/** 本人によるパスワード変更フォームの入力検証。 */
export function validatePasswordChange({
  currentPassword,
  newPassword,
  passwordConfirmation,
}: {
  currentPassword: string;
  newPassword: string;
  passwordConfirmation: string;
}) {
  if (!currentPassword || !newPassword || !passwordConfirmation) {
    return "すべての項目を入力してください";
  }

  const passwordError = validateAccountPassword(newPassword);
  if (passwordError) return passwordError;

  if (newPassword !== passwordConfirmation) {
    return "新しいパスワードが確認用の入力と一致しません";
  }
  if (newPassword === currentPassword) {
    return "現在とは異なるパスワードを設定してください";
  }

  return null;
}
