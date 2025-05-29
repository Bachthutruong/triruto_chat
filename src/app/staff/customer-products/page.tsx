'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Edit, Package, Clock, Calendar, Search, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { CustomerProduct } from '@/lib/types';

export default function StaffCustomerProductsPage() {
    const { toast } = useToast();
    const [customerProducts, setCustomerProducts] = useState<CustomerProduct[]>([]);
    const [filteredProducts, setFilteredProducts] = useState<CustomerProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<CustomerProduct | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'finished'>('all');

    const [editForm, setEditForm] = useState({
        productName: '',
        totalSessions: 1,
        usedSessions: 0,
        expiryDays: undefined as number | undefined,
        notes: '',
        isActive: true
    });

    useEffect(() => {
        fetchCustomerProducts();
    }, []);

    useEffect(() => {
        filterProducts();
    }, [customerProducts, searchTerm, statusFilter]);

    const fetchCustomerProducts = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/customer-products');
            const data = await response.json();
            if (data.success) {
                setCustomerProducts(data.data);
            }
        } catch (error) {
            console.error('Error fetching customer products:', error);
            toast({
                title: "Lỗi",
                description: "Có lỗi xảy ra khi tải dữ liệu",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const filterProducts = () => {
        let filtered = customerProducts;

        // Filter by search term
        if (searchTerm) {
            filtered = filtered.filter(cp =>
                cp.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (cp.customerId && cp.customerId.toString().includes(searchTerm))
            );
        }

        // Filter by status
        if (statusFilter !== 'all') {
            const now = new Date();
            filtered = filtered.filter(cp => {
                const isExpired = cp.expiryDate && new Date(cp.expiryDate) < now;
                const isFinished = cp.remainingSessions <= 0;

                switch (statusFilter) {
                    case 'active':
                        return cp.isActive && !isExpired && !isFinished;
                    case 'expired':
                        return isExpired;
                    case 'finished':
                        return isFinished;
                    default:
                        return true;
                }
            });
        }

        setFilteredProducts(filtered);
    };

    const handleEditProduct = async () => {
        if (!editingProduct) return;

        setLoading(true);
        try {
            const id = editingProduct.id || (editingProduct as any)._id;
            const response = await fetch(`/api/customer-products/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm)
            });

            const data = await response.json();
            if (data.success) {
                toast({
                    title: "Thành công",
                    description: "Đã cập nhật thông tin sản phẩm",
                });
                setIsEditDialogOpen(false);
                setEditingProduct(null);
                fetchCustomerProducts();
            } else {
                toast({
                    title: "Lỗi",
                    description: data.error || 'Có lỗi xảy ra',
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "Lỗi",
                description: "Có lỗi xảy ra khi cập nhật",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const openEditDialog = (customerProduct: CustomerProduct) => {
        setEditingProduct(customerProduct);
        setEditForm({
            productName: customerProduct.productName,
            totalSessions: customerProduct.totalSessions,
            usedSessions: customerProduct.usedSessions,
            expiryDays: customerProduct.expiryDays,
            notes: customerProduct.notes || '',
            isActive: customerProduct.isActive
        });
        setIsEditDialogOpen(true);
    };

    const formatDate = (date: Date | string | undefined) => {
        if (!date) return 'Không có';
        return new Date(date).toLocaleDateString('vi-VN');
    };

    const getStatusBadge = (customerProduct: CustomerProduct) => {
        const now = new Date();
        const isExpired = customerProduct.expiryDate && new Date(customerProduct.expiryDate) < now;
        const isFinished = customerProduct.remainingSessions <= 0;

        if (!customerProduct.isActive) {
            return <Badge variant="secondary">Không hoạt động</Badge>;
        }
        if (isExpired) {
            return <Badge variant="destructive">Hết hạn</Badge>;
        }
        if (isFinished) {
            return <Badge variant="outline">Hết buổi</Badge>;
        }
        return <Badge variant="default">Đang hoạt động</Badge>;
    };

    const getProgressPercentage = (used: number, total: number) => {
        return Math.round((used / total) * 100);
    };

    const getProgressColor = (percentage: number) => {
        if (percentage >= 90) return 'bg-red-500';
        if (percentage >= 70) return 'bg-yellow-500';
        return 'bg-green-500';
    };

    return (
        <div className="container mx-auto p-3 sm:p-6 max-w-7xl">
            <div className="flex flex-col gap-4 mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Quản lý Sản phẩm Khách hàng</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">Xem và chỉnh sửa thông tin sản phẩm/dịch vụ của khách hàng</p>
                </div>
            </div>

            {/* Filters */}
            <Card className="mb-6">
                <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
                        <div className="flex-1">
                            <Label htmlFor="search" className="text-sm">Tìm kiếm</Label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                <Input
                                    id="search"
                                    placeholder="Tìm theo tên sản phẩm hoặc ID khách hàng..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 h-9"
                                />
                            </div>
                        </div>
                        <div className="w-full sm:w-auto sm:min-w-[150px]">
                            <Label htmlFor="status" className="text-sm">Trạng thái</Label>
                            <select
                                id="status"
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as any)}
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                            >
                                <option value="all">Tất cả</option>
                                <option value="active">Đang hoạt động</option>
                                <option value="expired">Hết hạn</option>
                                <option value="finished">Hết buổi</option>
                            </select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Results */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg sm:text-xl">Danh sách sản phẩm/dịch vụ</CardTitle>
                    <CardDescription className="text-sm">
                        Hiển thị {filteredProducts.length} trong tổng số {customerProducts.length} sản phẩm
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0 sm:p-6">
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-2 text-muted-foreground text-sm">Đang tải...</p>
                        </div>
                    ) : (
                        <>
                            {/* Mobile Card View */}
                            <div className="block sm:hidden">
                                <div className="space-y-4 p-4">
                                    {filteredProducts.map((cp) => {
                                        const progressPercentage = getProgressPercentage(cp.usedSessions, cp.totalSessions);
                                        return (
                                            <Card key={cp.id || (cp as any)._id} className="p-4">
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <h3 className="font-semibold text-sm">{cp.productName}</h3>
                                                            <p className="text-xs text-muted-foreground">
                                                                ID: {typeof cp.customerId === 'object'
                                                                    ? ((cp.customerId as any).name || (cp.customerId as any).phoneNumber || (cp.customerId as any)._id)
                                                                    : cp.customerId}
                                                            </p>
                                                        </div>
                                                        {getStatusBadge(cp)}
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex justify-between text-sm">
                                                            <span>Còn {cp.remainingSessions}/{cp.totalSessions} buổi</span>
                                                            <span>{progressPercentage}%</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                                            <div
                                                                className={`h-2 rounded-full ${getProgressColor(progressPercentage)}`}
                                                                style={{ width: `${progressPercentage}%` }}
                                                            ></div>
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Đã dùng: {cp.usedSessions} buổi
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                                        <div>
                                                            <p className="text-muted-foreground">Ngày gán</p>
                                                            <p className="text-sm">{formatDate(cp.assignedDate)}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-muted-foreground">Hết hạn</p>
                                                            <p className="text-sm">{formatDate(cp.expiryDate)}</p>
                                                        </div>
                                                    </div>

                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => openEditDialog(cp)}
                                                        className="w-full"
                                                    >
                                                        <Edit className="w-3 h-3 mr-2" />
                                                        Chỉnh sửa
                                                    </Button>
                                                </div>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden sm:block overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Khách hàng</TableHead>
                                            <TableHead>Sản phẩm</TableHead>
                                            <TableHead>Tiến độ sử dụng</TableHead>
                                            <TableHead>Ngày gán</TableHead>
                                            <TableHead>Hết hạn</TableHead>
                                            <TableHead>Trạng thái</TableHead>
                                            <TableHead>Thao tác</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredProducts.map((cp) => {
                                            const progressPercentage = getProgressPercentage(cp.usedSessions, cp.totalSessions);
                                            return (
                                                <TableRow key={cp.id || (cp as any)._id}>
                                                    <TableCell>
                                                        <div>
                                                            <div className="font-medium">
                                                                {typeof cp.customerId === 'object'
                                                                    ? ((cp.customerId as any).name || (cp.customerId as any).phoneNumber || (cp.customerId as any)._id)
                                                                    : cp.customerId}
                                                            </div>
                                                            <div className="text-sm text-muted-foreground">ID: {typeof cp.customerId === 'object' ? (cp.customerId as any)._id : cp.customerId}</div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div>
                                                            <div className="font-medium">{cp.productName}</div>
                                                            <div className="text-sm text-muted-foreground">
                                                                <Package className="w-3 h-3 inline mr-1" />
                                                                {typeof cp.productId === 'object' && cp.productId !== null
                                                                    ? ((cp.productId as any).name || (cp.productId as any)._id)
                                                                    : cp.productId}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="space-y-2">
                                                            <div className="flex justify-between text-sm">
                                                                <span>Còn {cp.remainingSessions}/{cp.totalSessions} buổi</span>
                                                                <span>{progressPercentage}%</span>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                                <div
                                                                    className={`h-2 rounded-full ${getProgressColor(progressPercentage)}`}
                                                                    style={{ width: `${progressPercentage}%` }}
                                                                ></div>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground">
                                                                Đã dùng: {cp.usedSessions} buổi
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center text-sm">
                                                            <Calendar className="w-3 h-3 mr-1" />
                                                            {formatDate(cp.assignedDate)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex items-center text-sm">
                                                            <Clock className="w-3 h-3 mr-1" />
                                                            {formatDate(cp.expiryDate)}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {getStatusBadge(cp)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => openEditDialog(cp)}
                                                        >
                                                            <Edit className="w-3 h-3 mr-1" />
                                                            Sửa
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </>
                    )}

                    {!loading && filteredProducts.length === 0 && (
                        <div className="text-center py-8">
                            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                            <p className="text-muted-foreground">Không tìm thấy sản phẩm nào</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Edit Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-md mx-4 sm:mx-auto">
                    <DialogHeader>
                        <DialogTitle>Chỉnh sửa sản phẩm</DialogTitle>
                        <DialogDescription>
                            Cập nhật thông tin sản phẩm/dịch vụ của khách hàng
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                        <div>
                            <Label htmlFor="edit-name">Tên sản phẩm</Label>
                            <Input
                                value={editForm.productName}
                                onChange={(e) => setEditForm(prev => ({ ...prev, productName: e.target.value }))}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label htmlFor="edit-total">Tổng số buổi</Label>
                                <Input
                                    type="number"
                                    min="1"
                                    value={editForm.totalSessions}
                                    onChange={(e) => setEditForm(prev => ({
                                        ...prev,
                                        totalSessions: parseInt(e.target.value) || 1
                                    }))}
                                />
                            </div>
                            <div>
                                <Label htmlFor="edit-used">Đã sử dụng</Label>
                                <Input
                                    type="number"
                                    min="0"
                                    value={editForm.usedSessions}
                                    onChange={(e) => setEditForm(prev => ({
                                        ...prev,
                                        usedSessions: parseInt(e.target.value) || 0
                                    }))}
                                />
                            </div>
                        </div>

                        <div>
                            <Label htmlFor="edit-expiry">Thời hạn (ngày)</Label>
                            <Input
                                type="number"
                                min="1"
                                value={editForm.expiryDays || ''}
                                onChange={(e) => setEditForm(prev => ({
                                    ...prev,
                                    expiryDays: e.target.value ? parseInt(e.target.value) : undefined
                                }))}
                                placeholder="Không giới hạn"
                            />
                        </div>

                        <div>
                            <Label htmlFor="edit-notes">Ghi chú</Label>
                            <Textarea
                                value={editForm.notes}
                                onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                                placeholder="Ghi chú thêm..."
                                rows={3}
                            />
                        </div>

                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="edit-active"
                                checked={editForm.isActive}
                                onChange={(e) => setEditForm(prev => ({ ...prev, isActive: e.target.checked }))}
                            />
                            <Label htmlFor="edit-active">Đang hoạt động</Label>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                            <Button onClick={handleEditProduct} disabled={loading} className="flex-1">
                                {loading ? 'Đang cập nhật...' : 'Cập nhật'}
                            </Button>
                            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                                Hủy
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
} 