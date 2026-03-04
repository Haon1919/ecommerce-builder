import {
  encrypt,
  decrypt,
  anonymizeEmail,
  anonymizeName,
  hashForAnalytics,
  encryptJson,
  decryptJson,
} from './encryption';

// Mock the config module to provide a stable key for testing
jest.mock('../config', () => ({
  config: {
    encryption: {
      key: 'a-test-key-that-is-at-least-32-bytes-long-for-testing',
    },
  },
}));

describe('Encryption Service', () => {
  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string back to its original value', () => {
      const originalText = 'This is a secret message.';
      const encrypted = encrypt(originalText);
      const decrypted = decrypt(encrypted);

      expect(encrypted).not.toBe(originalText);
      expect(decrypted).toBe(originalText);
    });

    it('should return an empty string if an empty string is provided to encrypt or decrypt', () => {
      expect(encrypt('')).toBe('');
      expect(decrypt('')).toBe('');
    });

    it('should return an empty string on decryption failure from invalid format', () => {
      const invalidCiphertext = 'invalid-ciphertext';
      expect(decrypt(invalidCiphertext)).toBe('');
    });
    
    it('should return an empty string on decryption failure from bad data', () => {
        const badCiphertext = '616263:646566'; // valid hex, but not a valid cipher
        expect(decrypt(badCiphertext)).toBe('');
    });
  });

  describe('anonymizeEmail', () => {
    it('should correctly anonymize a standard email address', () => {
      const email = 'test.user@example.com';
      const anonymized = anonymizeEmail(email);
      expect(anonymized).toBe('t***@e***.com');
    });

    it('should handle emails with subdomains', () => {
        const email = 'another.user@mail.example.co.uk';
        const anonymized = anonymizeEmail(email);
        expect(anonymized).toBe('a***@m***.example.co.uk');
    });

    it('should handle emails with no domain gracefully', () => {
        const email = 'testuser';
        const anonymized = anonymizeEmail(email);
        expect(anonymized).toBe('***');
    });
  });

  describe('anonymizeName', () => {
    it('should correctly anonymize a name', () => {
      const name = 'John Doe';
      const anonymized = anonymizeName(name);
      expect(anonymized).toBe('J***');
    });
  });

  describe('hashForAnalytics', () => {
    it('should produce a consistent hash for the same input', () => {
      const value = 'user@example.com';
      const hash1 = hashForAnalytics(value);
      const hash2 = hashForAnalytics(value);
      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(value);
    });

    it('should produce a different hash for different input', () => {
      const value1 = 'user1@example.com';
      const value2 = 'user2@example.com';
      const hash1 = hashForAnalytics(value1);
      const hash2 = hashForAnalytics(value2);
      expect(hash1).not.toBe(hash2);
    });

    it('should produce the same hash regardless of case and whitespace', () => {
        const value1 = '  USER@EXAMPLE.COM  ';
        const value2 = 'user@example.com';
        const hash1 = hashForAnalytics(value1);
        const hash2 = hashForAnalytics(value2);
        expect(hash1).toBe(hash2);
    });
  });

  describe('encryptJson/decryptJson', () => {
    it('should encrypt and decrypt a JSON object back to its original value', () => {
      const originalObject = {
        street: '123 Main St',
        city: 'Anytown',
        zip: '12345',
      };
      const encrypted = encryptJson(originalObject);
      const decrypted = decryptJson(encrypted);

      expect(encrypted).not.toEqual(originalObject);
      expect(decrypted).toEqual(originalObject);
    });

    it('should return null if decryption fails', () => {
        const invalidCiphertext = 'invalid:ciphertext';
        expect(decryptJson(invalidCiphertext)).toBeNull();
    });

    it('should return null if the decrypted string is not valid JSON', () => {
        const nonJsonString = 'this is not json';
        const encrypted = encrypt(nonJsonString);
        expect(decryptJson(encrypted)).toBeNull();
    });
  });
});
