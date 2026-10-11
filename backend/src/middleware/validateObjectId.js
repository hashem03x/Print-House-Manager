import mongoose from 'mongoose';
import { ApiError } from '../utils/ApiError.js';

export function validateObjectId(paramName = 'id') {
  return (req, _res, next) => {
    const value = req.params[paramName];
    if (!mongoose.isValidObjectId(value) || !/^[a-f\d]{24}$/i.test(value)) {
      return next(
        ApiError.badRequest('Invalid task ID', { [paramName]: 'Must be a valid MongoDB ObjectId' }, 'INVALID_ID')
      );
    }
    next();
  };
}
