
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Search, Edit, Trash2, ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
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
import { getAllProducts, createProduct, updateProduct, deleteProduct } from '@/app/actions';
import type { ProductItem } from '@/lib/types';
// Removed imports related to service-specific scheduling (Accordion, Checkbox, etc.)

export default function StaffProductsPage() {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProduct, setCurrentProduct] = useState<ProductItem | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Removed states for service-specific scheduling rules

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        const data = await getAllProducts();
        setProducts(data);
        setFilteredProducts(data);
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
    };

    fetchProducts();
  }, [toast]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProducts(products);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const filtered = products.filter(
      (product) =>
        product.name.toLowerCase().includes(lowerQuery) ||
        product.description.toLowerCase().includes(lowerQuery) ||
        product.category.toLowerCase().includes(lowerQuery)
    );

    setFilteredProducts(filtered);
  }, [products, searchQuery]);

  const resetForm = () => {
    setCurrentProduct(null);
    setName('');
    setDescription('');
    setPrice('');
    setCategory('');
    setImageUrl('');
    setIsActive(true);
    // Reset states for service-specific scheduling rules
  };

  const handleOpenModal = (product: ProductItem | null = null) => {
    resetForm();
    if (product) {
      setCurrentProduct(product);
      setName(product.name);
      setDescription(product.description);
      setPrice(product.price.toString());
      setCategory(product.category);
      setImageUrl(product.imageUrl || '');
      setIsActive(product.isActive);
      // Set states for service-specific scheduling rules from product
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const productData = {
        name,
        description,
        price: parseFloat(price),
        category,
        imageUrl: imageUrl || undefined,
        isActive,
        // Removed isSchedulable and schedulingRules from productData
      };

      if (currentProduct) {
        const updatedProduct = await updateProduct(currentProduct.id, productData);
        if (updatedProduct) {
          setProducts((prevProducts) =>
            prevProducts.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
          );
          toast({ title: 'Thành công', description: 'Sản phẩm đã được cập nhật.' });
        }
      } else {
        const newProduct = await createProduct(productData);
        setProducts((prevProducts) => [newProduct, ...prevProducts]);
        toast({ title: 'Thành công', description: 'Sản phẩm mới đã được tạo.' });
      }

      resetForm();
      setIsModalOpen(false);
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể lưu sản phẩm.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      const result = await deleteProduct(productId);
      if (result.success) {
        setProducts((prevProducts) => prevProducts.filter((p) => p.id !== productId));
        toast({ title: 'Thành công', description: 'Sản phẩm đã được xóa.' });
      }
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể xóa sản phẩm.',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (date: Date) => {
    return format(new Date(date), 'dd/MM/yyyy');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Quản lý Sản phẩm/Dịch vụ</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Xem và quản lý danh sách sản phẩm và dịch vụ.</p>
        </div>
        <Button className="w-full sm:w-auto" onClick={() => handleOpenModal()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Thêm Sản phẩm Mới
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
                    <TableHead>Tên sản phẩm</TableHead>
                    <TableHead className="hidden md:table-cell">Danh mục</TableHead>
                    <TableHead>Giá</TableHead>
                    <TableHead className="hidden md:table-cell">Ngày tạo</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="hidden md:table-cell">{product.category}</TableCell>
                      <TableCell>{formatPrice(product.price)}</TableCell>
                      <TableCell className="hidden md:table-cell">{formatDate(product.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={product.isActive ? 'default' : 'secondary'}>
                          {product.isActive ? 'Đang bán' : 'Ngừng bán'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="mr-2"
                          onClick={() => handleOpenModal(product)}
                        >
                          <Edit className="h-4 w-4" />
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

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-2xl"> {/* Increased width for more fields */}
          <DialogHeader>
            <DialogTitle>{currentProduct ? 'Chỉnh sửa Sản phẩm' : 'Thêm Sản phẩm Mới'}</DialogTitle>
            <DialogDescription>
              {currentProduct
                ? 'Cập nhật thông tin chi tiết cho sản phẩm.'
                : 'Điền thông tin để tạo sản phẩm mới.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto p-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Tên sản phẩm <span className="text-destructive">*</span></Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Danh mục <span className="text-destructive">*</span></Label>
                  <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} required disabled={isSubmitting} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Mô tả <span className="text-destructive">*</span></Label>
                <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} required disabled={isSubmitting} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Giá (VND) <span className="text-destructive">*</span></Label>
                  <Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required disabled={isSubmitting} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status" className="block mb-2">Trạng thái</Label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                      className="h-4 w-4"
                      disabled={isSubmitting}
                    />
                    <Label htmlFor="isActive" className="font-normal">
                      Đang bán
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="imageUrl">URL Hình ảnh (tùy chọn)</Label>
                <Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} disabled={isSubmitting} placeholder="https://example.com/image.jpg" />
              </div>
              
              {/* Scheduling rules section removed */}

            </div>
            <DialogFooter className="pt-4 border-t mt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  Hủy
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? currentProduct
                    ? 'Đang cập nhật...'
                    : 'Đang tạo...'
                  : currentProduct
                  ? 'Lưu thay đổi'
                  : 'Tạo Sản phẩm'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
