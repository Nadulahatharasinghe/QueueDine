"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginUser = exports.registerUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const registerUser = async (fullName, email, password, phone, seatingPreference) => {
    const existingUser = await User_1.default.findOne({ email });
    if (existingUser) {
        throw new Error('Email already exists');
    }
    const hashedPassword = await bcryptjs_1.default.hash(password, 10);
    const user = await User_1.default.create({
        fullName,
        email,
        password: hashedPassword,
        phone,
        seatingPreference,
    });
    const token = jsonwebtoken_1.default.sign({ userId: user._id }, process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_in_production', { expiresIn: '7d' });
    return { user, token };
};
exports.registerUser = registerUser;
const loginUser = async (email, password) => {
    const user = await User_1.default.findOne({ email });
    if (!user) {
        throw new Error('Invalid credentials');
    }
    const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
    if (!isPasswordValid) {
        throw new Error('Invalid credentials');
    }
    const token = jsonwebtoken_1.default.sign({ userId: user._id }, process.env.JWT_SECRET || 'your_jwt_secret_key_change_this_in_production', { expiresIn: '7d' });
    return { user, token };
};
exports.loginUser = loginUser;
