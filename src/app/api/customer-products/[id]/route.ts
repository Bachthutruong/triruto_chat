import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import CustomerProductModel from '@/models/CustomerProduct.model';

// PUT - Cập nhật thông tin sản phẩm/dịch vụ của khách hàng
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await dbConnect();

        const { id } = await params;
        const body = await request.json();

        const customerProduct = await CustomerProductModel.findById(id);
        if (!customerProduct) {
            return NextResponse.json(
                { success: false, error: 'Không tìm thấy sản phẩm của khách hàng' },
                { status: 404 }
            );
        }

        // Cập nhật các trường được phép
        const allowedFields = [
            'productName',
            'totalSessions',
            'usedSessions',
            'expiryDays',
            'notes',
            'isActive'
        ];

        allowedFields.forEach(field => {
            if (body[field] !== undefined) {
                (customerProduct as any)[field] = body[field];
            }
        });

        // Tính lại ngày hết hạn nếu expiryDays thay đổi
        if (body.expiryDays !== undefined) {
            const expiryDate = new Date(customerProduct.assignedDate);
            expiryDate.setDate(expiryDate.getDate() + body.expiryDays);
            customerProduct.expiryDate = expiryDate;
        }

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
            message: 'Đã cập nhật thông tin sản phẩm thành công'
        });

    } catch (error: any) {
        console.error('Error updating customer product:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Xóa sản phẩm/dịch vụ của khách hàng
export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        await dbConnect();

        const { id } = await params;

        const customerProduct = await CustomerProductModel.findById(id);
        if (!customerProduct) {
            return NextResponse.json(
                { success: false, error: 'Không tìm thấy sản phẩm của khách hàng' },
                { status: 404 }
            );
        }

        await CustomerProductModel.findByIdAndDelete(id);

        return NextResponse.json({
            success: true,
            message: 'Đã xóa sản phẩm của khách hàng thành công'
        });

    } catch (error: any) {
        console.error('Error deleting customer product:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
} 