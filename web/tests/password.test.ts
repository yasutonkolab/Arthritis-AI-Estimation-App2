import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_PASSWORD_LENGTH,
  validateAccountPassword,
  validatePasswordChange,
} from "../src/lib/password.ts";

test("アカウント用パスワードは8〜72文字だけを受け入れる", () => {
  assert.equal(validateAccountPassword("1234567"), "パスワードは8文字以上にしてください");
  assert.equal(validateAccountPassword("12345678"), null);
  assert.equal(validateAccountPassword("a".repeat(MAX_PASSWORD_LENGTH)), null);
  assert.equal(
    validateAccountPassword("a".repeat(MAX_PASSWORD_LENGTH + 1)),
    "パスワードは72文字以内で入力してください"
  );
});

test("本人変更では必須入力、確認入力、現在とは異なる値を検証する", () => {
  assert.equal(
    validatePasswordChange({
      currentPassword: "",
      newPassword: "new-password",
      passwordConfirmation: "new-password",
    }),
    "すべての項目を入力してください"
  );
  assert.equal(
    validatePasswordChange({
      currentPassword: "old-password",
      newPassword: "new-password",
      passwordConfirmation: "different-password",
    }),
    "新しいパスワードが確認用の入力と一致しません"
  );
  assert.equal(
    validatePasswordChange({
      currentPassword: "same-password",
      newPassword: "same-password",
      passwordConfirmation: "same-password",
    }),
    "現在とは異なるパスワードを設定してください"
  );
  assert.equal(
    validatePasswordChange({
      currentPassword: "old-password",
      newPassword: "new-password",
      passwordConfirmation: "new-password",
    }),
    null
  );
});
