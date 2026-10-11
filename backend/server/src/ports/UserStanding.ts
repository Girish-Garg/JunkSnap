// Whether a signed-in user is blocked in the users table; a user without a row is not.
export interface UserStanding {
  isBlocked(userId: string): Promise<boolean>;
}
