'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
// Removed usePathname as isAdminRoute check is being removed
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Search, Edit, Trash2, ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getAllProducts, deleteProduct } from '@/app/actions';
import type { ProductItem } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminProductsManagementPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  // const pathname = usePathname(); // Removed
  // const [isAdminRoute, setIsAdminRoute] = useState(false); // Removed

  // New state for type filter
  const [typeFilter, setTypeFilter] = useState<'all' | 'product' | 'service'>('all');

  // useEffect(() => { // Removed useEffect for isAdminRoute
  //   if (pathname) {
  //     setIsAdminRoute(pathname.startsWith('/admin'));
  //   }
  // }, [pathname]);

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getAllProducts();
      setProducts(data);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: 'Lỗi',
        description: 'Không thể tải danh sách sản phẩm.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Use useMemo to compute filteredProducts
  const filteredProducts = useMemo(() => {
    console.log('Computing filtered products with useMemo...', { searchQuery, typeFilter, productCount: products.length });
    const lowerQuery = searchQuery.toLowerCase();
    const filtered = products.filter(
      (product) => {
        const matchesSearch =
          product.name.toLowerCase().includes(lowerQuery) ||
          (product.description && product.description.toLowerCase().includes(lowerQuery)) ||
          (product.category && product.category.toLowerCase().includes(lowerQuery));

        const matchesType =
          typeFilter === 'all' ||
          product.type === typeFilter;

        return matchesSearch && matchesType;
      }
    );
    console.log('useMemo computation complete. Filtered count:', filtered.length);
    return filtered;
  }, [products, searchQuery, typeFilter]); // Dependencies for useMemo

  const handleDeleteProduct = async (productId: string) => {
    try {
      const result = await deleteProduct(productId);
      if (result.success) {
        setProducts((prevProducts) => prevProducts.filter((p) => p.id !== productId));
        toast({ title: 'Thành công', description: 'Sản phẩm đã được xóa.' });
      } else {
        throw new Error("Lỗi xóa sản phẩm từ server.");
      }
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xóa sản phẩm.',
        variant: 'destructive',
      });
    }
  };

  const formatDateDisplay = (date: Date | string | undefined | null) => {
    if (!date) return 'N/A';
    try {
      return format(new Date(date), 'dd/MM/yyyy');
    } catch {
      return 'Invalid Date';
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  // const basePath = isAdminRoute ? '/admin' : '/staff'; // basePath will default to /admin for links as this page is also used by admin
  const basePath = '/admin'; // Assuming admin owns the primary product CRUD routes

  return (
    <div className="space-y-6" style={{ maxWidth: 'none', width: '1200px' }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Quản lý Sản phẩm/Dịch vụ</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Xem và quản lý danh sách sản phẩm và dịch vụ.</p>
        </div>
        {/* "Thêm Sản phẩm Mới" button is now always visible */}
        <Button className="w-full sm:w-auto" asChild>
          <Link href={`${basePath}/products/add`}>
            <PlusCircle className="mr-2 h-4 w-4" /> Thêm Sản phẩm Mới
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Tìm kiếm theo tên, mô tả, danh mục..."
            className="pl-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {/* New Type Filter */}
        <div className="w-full sm:w-auto">
          <Select value={typeFilter} onValueChange={(value: 'all' | 'product' | 'service') => setTypeFilter(value)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Lọc theo loại" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="product">Sản phẩm</SelectItem>
              <SelectItem value="service">Dịch vụ</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">Tất cả Sản phẩm/Dịch vụ</CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Danh sách tất cả sản phẩm và dịch vụ trong hệ thống.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-6">
              <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Không tìm thấy sản phẩm nào.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loại</TableHead>
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead className="hidden md:table-cell">Hạn sử dụng</TableHead>
                    <TableHead className="hidden md:table-cell">Danh mục</TableHead>
                    <TableHead>Giá</TableHead>
                    <TableHead className="hidden md:table-cell">Ngày tạo</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Đặt lịch?</TableHead>
                    {/* "Hành động" column is now always visible */}
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      {/* Assuming product.type exists and is either 'product' or 'service' */}
                      <TableCell>{product.type === 'service' ? 'Dịch vụ' : 'Sản phẩm'}</TableCell>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      {/* Assuming product.expiryDate exists and is a Date or null */}
                      <TableCell className="hidden md:table-cell">{formatDateDisplay(product.expiryDate)}</TableCell>
                      <TableCell className="hidden md:table-cell">{product.category}</TableCell>
                      <TableCell>{formatPrice(product.price)}</TableCell>
                      <TableCell className="hidden md:table-cell">{formatDateDisplay(product.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={product.isActive ? 'default' : 'secondary'}>
                          {product.isActive ? 'Đang bán' : 'Ngừng bán'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.isSchedulable ? 'outline' : 'secondary'} className={product.isSchedulable ? 'border-green-500 text-green-600' : ''}>
                          {product.isSchedulable ? 'Có thể' : 'Không'}
                        </Badge>
                      </TableCell>
                      {/* Action buttons are now always visible */}
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="mr-2"
                          asChild
                        >
                          <Link href={`${basePath}/products/edit/${product.id}`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Hành động này không thể hoàn tác. Sản phẩm "{product.name}" sẽ bị xóa vĩnh viễn.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Hủy</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteProduct(product.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Xóa
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
