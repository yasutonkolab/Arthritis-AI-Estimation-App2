import assert from "node:assert/strict";
import test from "node:test";
import {
  GENERATED_PASSWORD_LENGTH,
  generatePassword,
} from "../src/lib/generate-password.ts";

const LOWERCASE = /[abcdefghijkmnpqrstuvwxyz]/;
const UPPERCASE = /[ABCDEFGHJKLMNPQRSTUVWXYZ]/;
const DIGITS = /[23456789]/;
const SYMBOLS = /[!@#$%^*_\-+=?]/;
const ALLOWED = /^[abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^*_\-+=?]+$/;
const AMBIGUOUS = /[0O1lI]/;

test("生成パスワードは十分な長さと文字種を満たす", () => {
  for (let i = 0; i < 50; i += 1) {
    const password = generatePassword();
    assert.equal(password.length, GENERATED_PASSWORD_LENGTH);
    assert.match(password, ALLOWED);
    assert.match(password, LOWERCASE);
    assert.match(password, UPPERCASE);
    assert.match(password, DIGITS);
    assert.match(password, SYMBOLS);
    assert.doesNotMatch(password, AMBIGUOUS);
  }
});

test("生成パスワードは呼び出しごとに異なる", () => {
  const generated = new Set(Array.from({ length: 20 }, () => generatePassword()));
  assert.equal(generated.size, 20);
});
