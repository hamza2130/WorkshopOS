// Shared by the unit tests and the database parity test.
export const PHONE_SAMPLES: [string, string | null][] = [
  ["0300 1234567", "923001234567"],
  ["0300-1234567", "923001234567"],
  ["+92 300 1234567", "923001234567"],
  ["923001234567", "923001234567"],
  ["00923001234567", "923001234567"],
  ["3001234567", "923001234567"],
  ["042 35712345", "924235712345"],
  ["+44 20 7946 0958", "442079460958"],
  ["", null],
  ["abc", null],
];

export const REGISTRATION_SAMPLES = ["LEA-1234", "lea 1234", "Lea1234", " LEA - 1234 ", "ICT/AB-123"];
