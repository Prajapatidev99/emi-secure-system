const { body, param, validationResult } = require('express-validator');

// Validation middleware factory
const validate = (validations) => {
    return async (req, res, next) => {
        await Promise.all(validations.map(validation => validation.run(req)));

        const errors = validationResult(req);
        if (errors.isEmpty()) {
            return next();
        }

        res.status(400).json({
            message: 'Validation failed',
            errors: errors.array().map(err => ({
                field: err.path,
                message: err.msg
            }))
        });
    };
};

// Common validation rules
const validators = {
    // Customer validations
    customerName: body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s]+$/).withMessage('Name can only contain letters and spaces'),

    customerPhone: body('phone')
        .trim()
        .notEmpty().withMessage('Phone number is required')
        .matches(/^[0-9]{10}$/).withMessage('Phone number must be exactly 10 digits'),

    customerAddress: body('address')
        .trim()
        .notEmpty().withMessage('Address is required')
        .isLength({ min: 5, max: 500 }).withMessage('Address must be between 5 and 500 characters'),

    // Device validations
    deviceIMEI: body('imei')
        .trim()
        .notEmpty().withMessage('IMEI is required')
        .matches(/^[0-9]{15}$/).withMessage('IMEI must be exactly 15 digits'),

    deviceModel: body('model')
        .trim()
        .notEmpty().withMessage('Device model is required')
        .isLength({ min: 2, max: 100 }).withMessage('Model must be between 2 and 100 characters'),

    androidId: body('androidId')
        .trim()
        .notEmpty().withMessage('Android ID is required')
        .isLength({ min: 16, max: 16 }).withMessage('Android ID must be exactly 16 characters'),

    // Payment/EMI validations
    totalPrice: body('totalPrice')
        .isFloat({ min: 1 }).withMessage('Total price must be a positive number'),

    downPayment: body('downPayment')
        .isFloat({ min: 0 }).withMessage('Down payment must be a non-negative number'),

    numberOfEmis: body('numberOfEmis')
        .isInt({ min: 1, max: 60 }).withMessage('Number of EMIs must be between 1 and 60'),

    emiStartDate: body('emiStartDate')
        .isISO8601().withMessage('EMI start date must be a valid date'),

    // Auth validations
    email: body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Must be a valid email address')
        .normalizeEmail(),

    password: body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),

    // ID validations
    mongoId: param('id')
        .isMongoId().withMessage('Invalid ID format'),

    customerId: param('customerId')
        .isMongoId().withMessage('Invalid customer ID format'),

    deviceId: param('deviceId')
        .isMongoId().withMessage('Invalid device ID format'),

    paymentId: param('paymentId')
        .isMongoId().withMessage('Invalid payment ID format'),
};

module.exports = { validate, validators };
