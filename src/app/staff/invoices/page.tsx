'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Trash2, Package, Clock, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getAllProducts, getCustomersWithProductsAndReminders } from '@/app/actions';
import type { ProductItem, CustomerProduct, CreateInvoiceData, UserSession } from '@/lib/types';

// Type cho customer từ getCustomersWithProductsAndReminders
interface CustomerWithDetails {
    id: string;
    name?: string;
    internalName?: string;
    phoneNumber: string;
    tags?: string[];
    lastInteractionAt: Date;
    pendingRemindersCount: number;
}

export default function InvoicesPage() {
    const { toast } = useToast();
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [customers, setCustomers] = useState<CustomerWithDetails[]>([]);
    const [customerProducts, setCustomerProducts] = useState<CustomerProduct[]>([]);
    const [loading, setLoading] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<CustomerProduct | null>(null);
    const [currentSession, setCurrentSession] = useState<UserSession | null>(null);

    // Form states
    const [createForm, setCreateForm] = useState<CreateInvoiceData>({
        customerId: '',
        productId: '',
        totalSessions: 1,
        expiryDays: undefined,
        notes: '',
        staffId: ''
    });

    const [editForm, setEditForm] = useState({
        productName: '',
        totalSessions: 1,
        usedSessions: 0,
        expiryDays: undefined as number | undefined,
        notes: '',
        isActive: true
    });

    // Get session
    useEffect(() => {
        const sessionString = sessionStorage.getItem('aetherChatUserSession');
        if (sessionString) {
            setCurrentSession(JSON.parse(sessionString));
        }
    }, []);

    // Fetch data
    useEffect(() => {
        if (currentSession) {
            fetchData();
        }
    }, [currentSession]);

    const fetchData = async () => {
        try {
            setLoading(true);

            // Sử dụng API đúng như trong customers và products pages
            const [productsData, customersData] = await Promise.all([
                getAllProducts(),
                getCustomersWithProductsAndReminders(currentSession?.role === 'admin' ? undefined : currentSession?.id)
            ]);

            setProducts(productsData);
            setCustomers(customersData);
            await fetchCustomerProducts();

        } catch (error) {
            console.error('Error fetching data:', error);
            toast({
                title: "Lỗi",
                description: "Không thể tải dữ liệu",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomerProducts = async () => {
        try {
            const response = await fetch('/api/customer-products');
            const data = await response.json();
            if (data.success) {
                setCustomerProducts(data.data);
                return data.data;
            }
            return [];
        } catch (error) {
            console.error('Error fetching customer products:', error);
            toast({
                title: "Lỗi",
                description: "Không thể tải danh sách sản phẩm khách hàng",
                variant: "destructive",
            });
            return [];
        }
    };

    const handleCreateInvoice = async () => {
        if (!createForm.customerId || !createForm.productId) {
            toast({
                title: "Thiếu thông tin",
                description: "Vui lòng chọn khách hàng và sản phẩm",
                variant: "destructive",
            });
            return;
        }

        setLoading(true);
        try {
            const staffId = currentSession?.id || 'current-staff-id';

            const response = await fetch('/api/customer-products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...createForm, staffId })
            });

            const data = await response.json();
            if (data.success) {
                toast({
                    title: "Thành công",
                    description: "Đã tạo hóa đơn thành công",
                });
                setIsCreateDialogOpen(false);
                resetCreateForm();
                await fetchCustomerProducts();
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
                description: "Có lỗi xảy ra khi tạo hóa đơn",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const resetCreateForm = () => {
        setCreateForm({
            customerId: '',
            productId: '',
            totalSessions: 1,
            expiryDays: undefined,
            notes: '',
            staffId: ''
        });
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
                await fetchCustomerProducts();
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

    const getCustomerDisplayName = (customer: CustomerWithDetails) => {
        return customer.internalName || customer.name || `Người dùng ${customer.phoneNumber}`;
    };

    const selectedCustomer = customers.find(c => c.id === createForm.customerId);
    const selectedProduct = products.find(p => p.id === createForm.productId);

    if (loading && products.length === 0) {
        return (
            <div className="container mx-auto p-3 sm:p-6 max-w-7xl">
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    <span className="ml-2">Đang tải dữ liệu...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-3 sm:p-6 max-w-7xl">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold">Quản lý Hóa đơn & Sản phẩm</h1>
                    <p className="text-muted-foreground text-sm sm:text-base">Tạo hóa đơn và gán sản phẩm/dịch vụ cho khách hàng</p>
                </div>

                <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="w-full sm:w-auto">
                            <Plus className="w-4 h-4 mr-2" />
                            Tạo hóa đơn
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md mx-4 sm:mx-auto">
                        <DialogHeader>
                            <DialogTitle>Tạo hóa đơn bán hàng</DialogTitle>
                            <DialogDescription>
                                Chọn sản phẩm/dịch vụ và gán cho khách hàng
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            {/* Customer Selection */}
                            <div>
                                <Label htmlFor="customer">Khách hàng</Label>
                                <Select
                                    value={createForm.customerId}
                                    onValueChange={(value) => {
                                        setCreateForm(prev => ({ ...prev, customerId: value }));
                                    }}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Chọn khách hàng..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {customers.map((customer) => (
                                            <SelectItem key={customer.id} value={customer.id}>
                                                <div className="flex flex-col">
                                                    <span>{getCustomerDisplayName(customer)}</span>
                                                    <span className="text-xs text-muted-foreground">{customer.phoneNumber}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Product Selection */}
                            <div>
                                <Label htmlFor="product">Sản phẩm/Dịch vụ</Label>
                                <Select
                                    value={createForm.productId}
                                    onValueChange={(value) => {
                                        const product = products.find(p => p.id === value);
                                        setCreateForm(prev => ({
                                            ...prev,
                                            productId: value,
                                            totalSessions: product?.defaultSessions || 1,
                                            expiryDays: product?.expiryDays
                                        }));
                                    }}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Chọn sản phẩm..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {products.filter(p => p.isActive).map((product) => (
                                            <SelectItem key={product.id} value={product.id}>
                                                <div className="flex flex-col">
                                                    <span>{product.name}</span>
                                                    <span className="text-xs text-muted-foreground">
                                                        {product.category} - {product.price.toLocaleString('vi-VN')}đ
                                                    </span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="sessions">Số buổi</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={createForm.totalSessions}
                                        onChange={(e) => setCreateForm(prev => ({
                                            ...prev,
                                            totalSessions: parseInt(e.target.value) || 1
                                        }))}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="expiry">Thời hạn (ngày)</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={createForm.expiryDays || ''}
                                        onChange={(e) => setCreateForm(prev => ({
                                            ...prev,
                                            expiryDays: e.target.value ? parseInt(e.target.value) : undefined
                                        }))}
                                        placeholder="Không giới hạn"
                                    />
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="notes">Ghi chú</Label>
                                <Textarea
                                    value={createForm.notes}
                                    onChange={(e) => setCreateForm(prev => ({ ...prev, notes: e.target.value }))}
                                    placeholder="Ghi chú thêm..."
                                    rows={3}
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-2">
                                <Button onClick={handleCreateInvoice} disabled={loading} className="flex-1">
                                    {loading ? 'Đang tạo...' : 'Tạo hóa đơn'}
                                </Button>
                                <Button variant="outline" onClick={() => {
                                    setIsCreateDialogOpen(false);
                                    resetCreateForm();
                                }}>
                                    Hủy
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Tabs defaultValue="list" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="list" className="text-xs sm:text-sm">Danh sách đã gán</TabsTrigger>
                    <TabsTrigger value="products" className="text-xs sm:text-sm">Sản phẩm có sẵn</TabsTrigger>
                </TabsList>

                <TabsContent value="list" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg sm:text-xl">Sản phẩm/Dịch vụ đã gán cho khách hàng</CardTitle>
                            <CardDescription className="text-sm">
                                Danh sách tất cả sản phẩm/dịch vụ đã được gán cho khách hàng
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 sm:p-6">
                            {/* Mobile Card View */}
                            <div className="block sm:hidden">
                                <div className="space-y-4 p-4">
                                    {customerProducts.map((cp) => (
                                        <Card key={cp.id || (cp as any)._id} className="p-4">
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="font-semibold text-sm">{cp.productName || (typeof cp.productId === 'object' ? ((cp.productId as any).name || (cp.productId as any)._id) : cp.productId)}</h3>
                                                        <p className="text-xs text-muted-foreground">
                                                            {typeof cp.customerId === 'object'
                                                                ? ((cp.customerId as any).name || (cp.customerId as any).phoneNumber || (cp.customerId as any)._id)
                                                                : cp.customerId}
                                                        </p>
                                                    </div>
                                                    {getStatusBadge(cp)}
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    <div>
                                                        <p className="text-muted-foreground">Số buổi</p>
                                                        <p className="font-semibold">{cp.remainingSessions}/{cp.totalSessions}</p>
                                                        <p className="text-xs text-muted-foreground">Đã dùng: {cp.usedSessions}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Ngày gán</p>
                                                        <p className="text-sm">{formatDate(cp.assignedDate)}</p>
                                                    </div>
                                                </div>

                                                {cp.expiryDate && (
                                                    <div>
                                                        <p className="text-muted-foreground text-sm">Hết hạn</p>
                                                        <p className="text-sm">{formatDate(cp.expiryDate)}</p>
                                                    </div>
                                                )}

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
                                    ))}
                                </div>
                            </div>

                            {/* Desktop Table View */}
                            <div className="hidden sm:block overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Khách hàng</TableHead>
                                            <TableHead>Sản phẩm</TableHead>
                                            <TableHead>Số buổi</TableHead>
                                            <TableHead>Ngày gán</TableHead>
                                            <TableHead>Hết hạn</TableHead>
                                            <TableHead>Trạng thái</TableHead>
                                            <TableHead>Thao tác</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {customerProducts.map((cp) => (
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
                                                        <div className="font-medium">
                                                            {cp.productName || (typeof cp.productId === 'object' ? ((cp.productId as any).name || (cp.productId as any)._id) : cp.productId)}
                                                        </div>
                                                        <div className="text-sm text-muted-foreground">
                                                            <Package className="w-3 h-3 inline mr-1" />
                                                            {typeof cp.productId === 'object' ? (cp.productId as any)._id : cp.productId}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-center">
                                                        <div className="font-bold text-lg">
                                                            {cp.remainingSessions}/{cp.totalSessions}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Đã dùng: {cp.usedSessions}
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
                                                        <Edit className="w-3 h-3" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="products" className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {products.filter(p => p.isActive).map((product) => (
                            <Card key={product.id}>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base sm:text-lg">{product.name}</CardTitle>
                                    <CardDescription className="text-sm">{product.description}</CardDescription>
                                </CardHeader>
                                <CardContent className="pt-0">
                                    <div className="space-y-2">
                                        <div className="flex justify-between">
                                            <span className="text-sm">Giá:</span>
                                            <span className="font-bold text-sm">{product.price.toLocaleString('vi-VN')}đ</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-sm">Danh mục:</span>
                                            <Badge variant="outline" className="text-xs">{product.category}</Badge>
                                        </div>
                                        {product.defaultSessions && (
                                            <div className="flex justify-between">
                                                <span className="text-sm">Số buổi mặc định:</span>
                                                <span className="text-sm">{product.defaultSessions}</span>
                                            </div>
                                        )}
                                        {product.expiryDays && (
                                            <div className="flex justify-between">
                                                <span className="text-sm">Thời hạn:</span>
                                                <span className="text-sm">{product.expiryDays} ngày</span>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

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