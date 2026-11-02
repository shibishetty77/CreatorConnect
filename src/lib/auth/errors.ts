export class DuplicateAccountError extends Error {
  readonly field: "email" | "username";

  constructor(field: "email" | "username") {
    super(`An account with that ${field} already exists.`);
    this.name = "DuplicateAccountError";
    this.field = field;
  }
}
