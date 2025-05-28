'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, Calendar, Package, AlertTriangle, CheckCircle } from 'lucide-react';
import type { CustomerServiceUsage } from '@/lib/types';

interface CustomerServiceUsageProps {
    customerId: string;
    className?: string;
}

export default function CustomerServiceUsage({ customerId, className }: CustomerServiceUsageProps) {
    const [serviceUsage, setServiceUsage] = useState<CustomerServiceUsage | null>(null);
    const [standaloneSessionsTotal, setStandaloneSessionsTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (customerId) {
            fetchServiceUsage();
        }
    }, [customerId]);

    const fetchServiceUsage = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/customer-service-usage?customerId=${customerId}`);
            const data = await response.json();

            if (data.success) {
                setServiceUsage(data.data);
                setStandaloneSessionsTotal(data.standaloneSessionsTotal || 0);
            }
        } catch (error) {
            console.error('Error fetching service usage:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: Date | string | undefined) => {
        if (!date) return 'Chưa có';
        return new Date(date).toLocaleDateString('vi-VN');
    };

    const getProgressColor = (used: number, total: number) => {
        const percentage = (used / total) * 100;
        if (percentage >= 90) return 'bg-red-500';
        if (percentage >= 70) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    const getStatusIcon = (product: any) => {
        if (product.isExpired) {
            return <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-red-500" />;
        }
        if (product.remainingSessions <= 0) {
            return <AlertTriangle className="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />;
        }
        return <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />;
    };

    if (loading) {
        return (
            <Card className={className}>
                <CardContent className="p-3 sm:p-4">
                    <div className="animate-pulse space-y-2">
                        <div className="h-3 sm:h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 sm:h-4 bg-gray-200 rounded w-1/2"></div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!serviceUsage) {
        return (
            <Card className={className}>
                <CardContent className="p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-muted-foreground">Không có thông tin sử dụng dịch vụ</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className={`space-y-3 sm:space-y-4 ${className}`}>
            {/* Thông tin lần hẹn cuối */}
            {serviceUsage.daysSinceLastAppointment !== undefined && (
                <Card>
                    <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-blue-500 shrink-0" />
                            <span className="text-xs sm:text-sm font-medium">
                                Lần hẹn gần nhất cách đây {serviceUsage.daysSinceLastAppointment} ngày
                            </span>
                        </div>
                        {serviceUsage.lastAppointmentDate && (
                            <p className="text-xs text-muted-foreground mt-1 ml-5 sm:ml-6">
                                Ngày: {formatDate(serviceUsage.lastAppointmentDate)}
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Danh sách sản phẩm/dịch vụ */}
            {serviceUsage.products.length > 0 && (
                <Card>
                    <CardHeader className="pb-2 sm:pb-3 p-3 sm:p-6">
                        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                            <Package className="w-3 h-3 sm:w-4 sm:h-4 shrink-0" />
                            <span className="truncate">Sản phẩm/Dịch vụ đang sử dụng</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 sm:space-y-3 p-3 sm:p-6 pt-0">
                        {serviceUsage.products.map((product) => (
                            <div key={product.customerProductId} className="border rounded-lg p-2 sm:p-3 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {getStatusIcon(product)}
                                        <span className="font-medium text-xs sm:text-sm truncate">{product.productName}</span>
                                    </div>
                                    {product.isExpired && (
                                        <Badge variant="destructive" className="text-xs shrink-0">Hết hạn</Badge>
                                    )}
                                </div>

                                {/* Progress bar cho số buổi */}
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span>Còn {product.remainingSessions}/{product.totalSessions} buổi</span>
                                        <span>{Math.round((product.usedSessions / product.totalSessions) * 100)}%</span>
                                    </div>
                                    <Progress
                                        value={(product.usedSessions / product.totalSessions) * 100}
                                        className="h-1.5 sm:h-2"
                                    />
                                </div>

                                {/* Thông tin thời hạn và lần sử dụng cuối */}
                                <div className="space-y-1">
                                    {product.expiryDate && (
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Clock className="w-3 h-3 shrink-0" />
                                            <span className="truncate">Hết hạn: {formatDate(product.expiryDate)}</span>
                                        </div>
                                    )}

                                    {product.daysSinceLastUse !== undefined && (
                                        <div className="text-xs text-muted-foreground">
                                            Sử dụng cuối: {product.daysSinceLastUse} ngày trước
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Số buổi lẻ */}
            {standaloneSessionsTotal > 0 && (
                <Card>
                    <CardContent className="p-3 sm:p-4">
                        <div className="flex items-center gap-2">
                            <Package className="w-3 h-3 sm:w-4 sm:h-4 text-purple-500 shrink-0" />
                            <span className="text-xs sm:text-sm font-medium">
                                Đã sử dụng {standaloneSessionsTotal} buổi lẻ (không theo gói)
                            </span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Trường hợp không có sản phẩm nào */}
            {serviceUsage.products.length === 0 && standaloneSessionsTotal === 0 && (
                <Card>
                    <CardContent className="p-3 sm:p-4">
                        <p className="text-xs sm:text-sm text-muted-foreground text-center">
                            Khách hàng chưa sử dụng sản phẩm/dịch vụ nào
                        </p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
} 