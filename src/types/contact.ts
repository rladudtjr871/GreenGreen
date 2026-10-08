export const CONTACT_TITLE_MAX_LENGTH = 100;
export const CONTACT_MESSAGE_MAX_LENGTH = 2_000;

export type ContactRequest = {
  title: string;
  message: string;
};

export type ContactFieldErrors = Partial<Record<keyof ContactRequest, string>>;
