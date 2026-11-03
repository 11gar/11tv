/** Erreur dont le message, en français, peut être montré tel quel sur le téléphone. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}
