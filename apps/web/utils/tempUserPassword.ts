/** Временный пароль при сбросе админом: 6 цифр (легко продиктовать, без Tmp/hex). */
export function generateTempUserPassword(): string {
  return String(100000 + Math.floor(Math.random() * 900000));
}
