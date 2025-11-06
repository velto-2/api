export class ValidatorsUtil {
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  static isValidSaudiPhone(phone: string): boolean {
    // Saudi phone number validation (starts with +966 or 966 or 05)
    const saudiPhoneRegex = /^(\+966|966|0)?5[0-9]{8}$/;
    return saudiPhoneRegex.test(phone.replace(/\s/g, ''));
  }

  static isValidSaudiNationalId(nationalId: string): boolean {
    // Saudi National ID validation (10 digits)
    const nationalIdRegex = /^[12][0-9]{9}$/;
    return nationalIdRegex.test(nationalId);
  }

  static isValidIqamaNumber(iqamaNumber: string): boolean {
    // Iqama number validation (10 digits, starts with specific numbers)
    const iqamaRegex = /^[3-9][0-9]{9}$/;
    return iqamaRegex.test(iqamaNumber);
  }

  static isValidCRNumber(crNumber: string): boolean {
    // Commercial Registration number validation
    const crRegex = /^[1-9][0-9]{9}$/;
    return crRegex.test(crNumber);
  }

  static isValidVATNumber(vatNumber: string): boolean {
    // VAT number validation (15 digits)
    const vatRegex = /^[0-9]{15}$/;
    return vatRegex.test(vatNumber);
  }

  static isStrongPassword(password: string): boolean {
    // At least 8 characters, one uppercase, one lowercase, one number, one special char
    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return strongPasswordRegex.test(password);
  }

  static sanitizeInput(input: string): string {
    return input.trim().replace(/[<>]/g, '');
  }

  static isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  }

  static isValidAmount(amount: number): boolean {
    return amount > 0 && Number.isFinite(amount);
  }

  static normalizePhoneNumber(phone: string): string {
    // Remove spaces and convert to international format
    let normalized = phone.replace(/\s/g, '');
    
    if (normalized.startsWith('05')) {
      normalized = '+966' + normalized.substring(1);
    } else if (normalized.startsWith('966')) {
      normalized = '+' + normalized;
    } else if (!normalized.startsWith('+966')) {
      normalized = '+966' + normalized;
    }
    
    return normalized;
  }
}