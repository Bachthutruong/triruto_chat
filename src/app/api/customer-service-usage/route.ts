import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import CustomerProductModel from '@/models/CustomerProduct.model';
import AppointmentModel from '@/models/Appointment.model';
import CustomerModel from '@/models/Customer.model';
import type { CustomerServiceUsage } from '@/lib/types';

// GET - Lấy thông tin sử dụng dịch vụ của khách hàng
export async function GET(request: NextRequest) {
    try {
        await dbConnect();

        const { searchParams } = new URL(request.url);
        const customerId = searchParams.get('customerId');

        if (!customerId) {
            return NextResponse.json(
                { success: false, error: 'customerId là bắt buộc' },
                { status: 400 }
            );
        }

        // Lấy thông tin khách hàng
        const customer = await CustomerModel.findById(customerId);
        if (!customer) {
            return NextResponse.json(
                { success: false, error: 'Khách hàng không tồn tại' },
                { status: 404 }
            );
        }

        // Lấy danh sách sản phẩm/dịch vụ của khách hàng
        const customerProducts = await CustomerProductModel
            .find({ customerId, isActive: true })
            .populate('productId', 'name description category');

        // Lấy lịch hẹn gần nhất của khách hàng
        const lastAppointment = await AppointmentModel
            .findOne({
                customerId,
                status: { $in: ['completed', 'booked'] }
            })
            .sort({ date: -1, time: -1 });

        // Tính số buổi lẻ đã sử dụng (không theo gói)
        const standaloneAppointments = await AppointmentModel.countDocuments({
            customerId,
            isStandaloneSession: true,
            isSessionUsed: true
        });

        // Tính khoảng cách từ lần hẹn cuối
        let daysSinceLastAppointment: number | undefined;
        let lastAppointmentDate: Date | undefined;

        if (lastAppointment) {
            lastAppointmentDate = new Date(`${lastAppointment.date}T${lastAppointment.time}`);
            const now = new Date();
            daysSinceLastAppointment = Math.floor(
                (now.getTime() - lastAppointmentDate.getTime()) / (1000 * 60 * 60 * 24)
            );
        }

        // Xử lý thông tin từng sản phẩm
        const products = customerProducts.map(cp => {
            let daysSinceLastUse: number | undefined;

            if (cp.lastUsedDate) {
                const now = new Date();
                daysSinceLastUse = Math.floor(
                    (now.getTime() - cp.lastUsedDate.getTime()) / (1000 * 60 * 60 * 24)
                );
            }

            const isExpired = cp.expiryDate ? new Date() > cp.expiryDate : false;

            return {
                customerProductId: (cp as any)._id.toString(),
                productName: cp.productName,
                totalSessions: cp.totalSessions,
                usedSessions: cp.usedSessions,
                remainingSessions: cp.remainingSessions,
                expiryDate: cp.expiryDate,
                daysSinceLastUse,
                isExpired,
                standaloneSessionsUsed: 0 // Sẽ được tính riêng cho từng sản phẩm nếu cần
            };
        });

        const serviceUsage: CustomerServiceUsage = {
            customerId: customerId,
            customerName: customer.name,
            products,
            lastAppointmentDate,
            daysSinceLastAppointment
        };

        return NextResponse.json({
            success: true,
            data: serviceUsage,
            standaloneSessionsTotal: standaloneAppointments
        });

    } catch (error: any) {
        console.error('Error fetching customer service usage:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
} 