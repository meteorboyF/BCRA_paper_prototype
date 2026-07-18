// Display names for MSP identifiers, aligned with the organization naming
// used in the consortium documentation (LawFirmA / LawFirmB / Regulator).
// Fabric artifact identifiers are unchanged; this is presentation only.
export const MSP_DISPLAY: Record<string, string> = {
  FirmAMSP: 'LawFirmAMSP',
  FirmBMSP: 'LawFirmBMSP',
  RegulatorMSP: 'RegulatorMSP',
}

export const mspDisplay = (msp: string | null | undefined): string =>
  msp ? (MSP_DISPLAY[msp] ?? msp) : ''
