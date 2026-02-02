const forbiddenPatterns: RegExp[] = [
  /@/g,                         // emails
  /\b\d{7,}\b/g,               // phone numbers (7+ digits)
  /(http|https):\/\//gi,       // links
  /\bwww\./gi,
  /(whatsapp|telegram|signal|wechat)/gi,
  /(email|phone|contact me)/gi,
  /@[a-z0-9_]+/gi               // social handles
];

export const containsContactInfo = (text?: string): boolean => {
  if (!text) return false;
  return forbiddenPatterns.some((rx) => rx.test(text));
};