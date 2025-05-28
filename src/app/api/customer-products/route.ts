import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import CustomerProductModel from '@/models/CustomerProduct.model';
import ProductModel from '@/models/Product.model';
import CustomerModel from '@/models/Customer.model';
import UserModel from '@/models/User.model';
import type { CreateInvoiceData } from '@/lib/types';

// GET - Lấy danh sách sản phẩm/dịch vụ của khách hàng
export async function GET(request: NextRequest) {
    try {
        await dbConnect();

        const { searchParams } = new URL(request.url);
        const customerId = searchParams.get('customerId');
        const staffId = searchParams.get('staffId');
        const isActive = searchParams.get('isActive');

        let query: any = {};

        if (customerId) {
            query.customerId = customerId;
        }

        if (staffId) {
            query.staffId = staffId;
        }

        if (isActive !== null) {
            query.isActive = isActive === 'true';
        }

        const customerProducts = await CustomerProductModel
            .find(query)
            .populate('customerId', 'name phoneNumber')
            .populate('productId', 'name description category')
            .populate('staffId', 'name')
            .sort({ createdAt: -1 });

        return NextResponse.json({
            success: true,
            data: customerProducts
        });

    } catch (error: any) {
        console.error('Error fetching customer products:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// POST - Tạo hóa đơn bán hàng (gán sản phẩm cho khách)
export async function POST(request: NextRequest) {
    try {
        await dbConnect();

        const body: CreateInvoiceData = await request.json();
        const { customerId, productId, totalSessions, expiryDays, notes, staffId } = body;

        // Kiểm tra customer tồn tại
        const customer = await CustomerModel.findById(customerId);
        if (!customer) {
            return NextResponse.json(
                { success: false, error: 'Khách hàng không tồn tại' },
                { status: 404 }
            );
        }

        // Kiểm tra product tồn tại
        const product = await ProductModel.findById(productId);
        if (!product) {
            return NextResponse.json(
                { success: false, error: 'Sản phẩm không tồn tại' },
                { status: 404 }
            );
        }

        // Kiểm tra staff tồn tại
        const staff = await UserModel.findById(staffId);
        if (!staff) {
            return NextResponse.json(
                { success: false, error: 'Nhân viên không tồn tại' },
                { status: 404 }
            );
        }

        // Tính ngày hết hạn
        let expiryDate: Date | undefined;
        const finalExpiryDays = expiryDays || product.expiryDays;

        if (finalExpiryDays) {
            expiryDate = new Date();
            expiryDate.setDate(expiryDate.getDate() + finalExpiryDays);
        }

        // Tạo CustomerProduct mới
        const customerProduct = new CustomerProductModel({
            customerId,
            productId,
            productName: product.name,
            totalSessions: totalSessions || product.defaultSessions || 1,
            usedSessions: 0,
            remainingSessions: totalSessions || product.defaultSessions || 1,
            assignedDate: new Date(),
            expiryDate,
            expiryDays: finalExpiryDays,
            isActive: true,
            staffId,
            notes
        });

        await customerProduct.save();

        // Populate thông tin để trả về
        await customerProduct.populate([
            { path: 'customerId', select: 'name phoneNumber' },
            { path: 'productId', select: 'name description category' },
            { path: 'staffId', select: 'name' }
        ]);

        return NextResponse.json({
            success: true,
            data: customerProduct,
            message: 'Đã tạo hóa đơn và gán sản phẩm cho khách hàng thành công'
        });

    } catch (error: any) {
        console.error('Error creating customer product:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
} 