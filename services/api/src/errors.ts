export class NotFoundError extends Error {
  constructor(msg = 'Not found') {
    super(msg);
    this.name = 'NotFoundError';
  }
}

export class InsufficientStockError extends Error {
  constructor(msg = 'Insufficient stock') {
    super(msg);
    this.name = 'InsufficientStockError';
  }
}

export class ValidationError extends Error {
  constructor(msg = 'Validation error') {
    super(msg);
    this.name = 'ValidationError';
  }
}
