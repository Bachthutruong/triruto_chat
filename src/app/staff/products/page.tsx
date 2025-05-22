
'use client';

import { useState, useEffect, Fragment, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { PlusCircle, Search, Edit, Trash2, ImageIcon, CalendarCog, ClockIcon, UsersIcon, CalendarDays, Save, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, parse, isValid as isValidDateFns } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import type { ProductItem, ProductSchedulingRules, SpecificDayRule } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';

const daysOfWeek = [
  { id: 1, label: 'Thứ 2' }, { id: 2, label: 'Thứ 3' }, { id: 3, label: 'Thứ 4' },
  { id: 4, label: 'Thứ 5' }, { id: 5, label: 'Thứ 6' }, { id: 6, label: 'Thứ 7' },
  { id: 0, label: 'Chủ nhật' } 
];

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

  // New state for service-specific scheduling rules
  const [isSchedulable, setIsSchedulable] = useState(true);
  const [productSchedulingRules, setProductSchedulingRules] = useState<Partial<ProductSchedulingRules>>({});

  // State for temporary input for specific day rules for a product
  const [tempProductSpecRuleDate, setTempProductSpecRuleDate] = useState('');
  const [tempProductSpecRuleIsOff, setTempProductSpecRuleIsOff] = useState(false);
  const [tempProductSpecRuleHours, setTempProductSpecRuleHours] = useState('');
  const [tempProductSpecRuleStaff, setTempProductSpecRuleStaff] = useState('');
  const [tempProductSpecRuleDuration, setTempProductSpecRuleDuration] = useState('');
  
  // State for temporary input for one-time off dates for a product
  const [tempProductOneTimeOffDate, setTempProductOneTimeOffDate] = useState('');


  const fetchProducts = useCallback(async () => {
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
  }, [toast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredProducts(products);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const filtered = products.filter(
      (product) =>
        product.name.toLowerCase().includes(lowerQuery) ||
        (product.description && product.description.toLowerCase().includes(lowerQuery)) ||
        (product.category && product.category.toLowerCase().includes(lowerQuery))
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
    setIsSchedulable(true);
    setProductSchedulingRules({});
    setTempProductSpecRuleDate('');
    setTempProductSpecRuleIsOff(false);
    setTempProductSpecRuleHours('');
    setTempProductSpecRuleStaff('');
    setTempProductSpecRuleDuration('');
    setTempProductOneTimeOffDate('');
  };

  const handleOpenModal = (product: ProductItem | null = null) => {
    resetForm();
    if (product) {
      setCurrentProduct(product);
      setName(product.name);
      setDescription(product.description || '');
      setPrice(product.price.toString());
      setCategory(product.category || '');
      setImageUrl(product.imageUrl || '');
      setIsActive(product.isActive);
      setIsSchedulable(product.isSchedulable ?? true); 
      // Ensure specificDayRules have temporary client-side IDs if they don't have one from DB
      const initialSchedulingRules = product.schedulingRules || {};
      if (initialSchedulingRules.specificDayRules) {
        initialSchedulingRules.specificDayRules = initialSchedulingRules.specificDayRules.map(rule => ({
          ...rule,
          id: rule.id || `client-${Date.now()}-${Math.random()}` // Assign temporary ID if missing
        }));
      }
      setProductSchedulingRules(initialSchedulingRules);
    } else {
      setIsSchedulable(true); 
      setProductSchedulingRules({});
    }
    setIsModalOpen(true);
  };
  
  const handleSchedulingRuleChange = (field: keyof ProductSchedulingRules, value: any) => {
    setProductSchedulingRules(prev => ({ ...prev, [field]: value }));
  };

  const handleProductWeeklyOffDayChange = (dayId: number, checked: boolean | 'indeterminate') => {
    const currentOffDays = productSchedulingRules.weeklyOffDays || [];
    const newOffDays = checked === true
      ? [...currentOffDays, dayId].filter((v, i, a) => a.indexOf(v) === i) 
      : currentOffDays.filter(d => d !== dayId);
    handleSchedulingRuleChange('weeklyOffDays', newOffDays.length > 0 ? newOffDays : undefined); 
  };
  

  const handleAddProductOneTimeOffDate = () => {
    if (tempProductOneTimeOffDate && !isValidDateFns(parse(tempProductOneTimeOffDate, 'yyyy-MM-dd', new Date()))) {
        toast({ title: "Lỗi định dạng ngày", description: "Ngày nghỉ riêng không hợp lệ. Phải là YYYY-MM-DD.", variant: "destructive" });
        return;
    }
    if (tempProductOneTimeOffDate) {
        const currentDates = productSchedulingRules.oneTimeOffDates || [];
        if (!currentDates.includes(tempProductOneTimeOffDate)) {
            const newDates = [...currentDates, tempProductOneTimeOffDate];
            handleSchedulingRuleChange('oneTimeOffDates', newDates);
        }
        setTempProductOneTimeOffDate('');
    }
  };
  
  const handleRemoveProductOneTimeOffDate = (dateToRemove: string) => {
    const newDates = (productSchedulingRules.oneTimeOffDates || []).filter(d => d !== dateToRemove);
    handleSchedulingRuleChange('oneTimeOffDates', newDates.length > 0 ? newDates : undefined); 
  };

  const handleAddProductSpecificDayRule = () => {
    if (!tempProductSpecRuleDate || !isValidDateFns(parse(tempProductSpecRuleDate, 'yyyy-MM-dd', new Date()))) {
      toast({ title: "Thiếu thông tin", description: "Vui lòng chọn ngày hợp lệ (YYYY-MM-DD) cho quy tắc cụ thể của sản phẩm.", variant: "destructive" });
      return;
    }
    const newRule: SpecificDayRule = { 
      id: `client-${Date.now()}-${Math.random()}`, // Client-side temporary ID
      date: tempProductSpecRuleDate,
      isOff: tempProductSpecRuleIsOff,
      workingHours: tempProductSpecRuleHours.split(',').map(h => h.trim()).filter(h => /^[0-2][0-9]:[0-5][0-9]$/.test(h)).length > 0 ? tempProductSpecRuleHours.split(',').map(h => h.trim()).filter(h => /^[0-2][0-9]:[0-5][0-9]$/.test(h)) : undefined,
      numberOfStaff: tempProductSpecRuleStaff.trim() !== '' ? parseFloat(tempProductSpecRuleStaff) : undefined,
      serviceDurationMinutes: tempProductSpecRuleDuration.trim() !== '' ? parseFloat(tempProductSpecRuleDuration) : undefined,
    };
    const existingRules = productSchedulingRules.specificDayRules || [];
    handleSchedulingRuleChange('specificDayRules', [...existingRules, newRule]);
    setTempProductSpecRuleDate(''); setTempProductSpecRuleIsOff(false); setTempProductSpecRuleHours(''); setTempProductSpecRuleStaff(''); setTempProductSpecRuleDuration('');
  };

  const handleRemoveProductSpecificDayRule = (idToRemove: string) => {
    const newRules = (productSchedulingRules.specificDayRules || []).filter(rule => rule.id !== idToRemove);
    handleSchedulingRuleChange('specificDayRules', newRules.length > 0 ? newRules : undefined); 
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const productData: Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt'> = {
        name,
        description,
        price: parseFloat(price) || 0,
        category,
        imageUrl: imageUrl || undefined,
        isActive,
        isSchedulable,
        schedulingRules: isSchedulable ? {
            numberOfStaff: productSchedulingRules.numberOfStaff !== undefined && !isNaN(parseFloat(productSchedulingRules.numberOfStaff as any)) ? parseFloat(productSchedulingRules.numberOfStaff as any) : undefined,
            serviceDurationMinutes: productSchedulingRules.serviceDurationMinutes !== undefined && !isNaN(parseFloat(productSchedulingRules.serviceDurationMinutes as any)) ? parseFloat(productSchedulingRules.serviceDurationMinutes as any) : undefined,
            workingHours: (productSchedulingRules.workingHours && Array.isArray(productSchedulingRules.workingHours) && productSchedulingRules.workingHours.length > 0) ? productSchedulingRules.workingHours : undefined,
            weeklyOffDays: (productSchedulingRules.weeklyOffDays && Array.isArray(productSchedulingRules.weeklyOffDays) && productSchedulingRules.weeklyOffDays.length > 0) ? productSchedulingRules.weeklyOffDays : undefined,
            oneTimeOffDates: (productSchedulingRules.oneTimeOffDates && Array.isArray(productSchedulingRules.oneTimeOffDates) && productSchedulingRules.oneTimeOffDates.length > 0) ? productSchedulingRules.oneTimeOffDates : undefined,
            specificDayRules: (productSchedulingRules.specificDayRules || []).map(r => { const { id, ...rest } = r; return rest; }), // Remove client-side temp ID
        } : undefined,
      };
      
      
      if (productData.schedulingRules) {
        if (productData.schedulingRules.specificDayRules?.length === 0) {
            delete productData.schedulingRules.specificDayRules;
        }
        if (productData.schedulingRules.workingHours?.length === 0) {
            delete productData.schedulingRules.workingHours;
        }
        if (productData.schedulingRules.weeklyOffDays?.length === 0) {
            delete productData.schedulingRules.weeklyOffDays;
        }
        if (productData.schedulingRules.oneTimeOffDates?.length === 0) {
            delete productData.schedulingRules.oneTimeOffDates;
        }
        
        if (Object.values(productData.schedulingRules).every(value => value === undefined || (Array.isArray(value) && value.length === 0))) {
          delete productData.schedulingRules;
        }
      }


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
      fetchProducts(); // Re-fetch products to update the list
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

  const formatDateDisplay = (date: Date | string | undefined) => {
    if (!date) return 'N/A';
    try {
      return format(new Date(date), 'dd/MM/yyyy');
    } catch {
      return 'Invalid Date';
    }
  };

  const formatPrice = (priceVal: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(priceVal);
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
                    <TableHead>Đặt lịch?</TableHead>
                    <TableHead className="text-right">Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.name}</TableCell>
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
        <DialogContent className="sm:max-w-3xl"> 
          <DialogHeader>
            <DialogTitle>{currentProduct ? 'Chỉnh sửa Sản phẩm/Dịch vụ' : 'Thêm Sản phẩm/Dịch vụ Mới'}</DialogTitle>
            <DialogDescription>
              {currentProduct
                ? 'Cập nhật thông tin chi tiết.'
                : 'Điền thông tin để tạo mới.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <ScrollArea className="max-h-[75vh] p-1 pr-3">
              <div className="space-y-4 ">
                
                <Card>
                  <CardHeader><CardTitle className="text-lg">Thông tin cơ bản</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5"><Label htmlFor="name">Tên <span className="text-destructive">*</span></Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={isSubmitting} /></div>
                      <div className="space-y-1.5"><Label htmlFor="category">Danh mục <span className="text-destructive">*</span></Label><Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} required disabled={isSubmitting} /></div>
                    </div>
                    <div className="space-y-1.5"><Label htmlFor="description">Mô tả</Label><Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={isSubmitting} /></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5"><Label htmlFor="price">Giá (VND) <span className="text-destructive">*</span></Label><Input id="price" type="number" value={price} onChange={(e) => setPrice(e.target.value)} required disabled={isSubmitting} /></div>
                      <div className="space-y-1.5"><Label htmlFor="imageUrl">URL Hình ảnh</Label><Input id="imageUrl" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} disabled={isSubmitting} placeholder="https://example.com/image.jpg" /></div>
                    </div>
                     <div className="flex items-center space-x-2 pt-2">
                        <Checkbox id="isActive" checked={isActive} onCheckedChange={(checked) => setIsActive(!!checked)} disabled={isSubmitting} />
                        <Label htmlFor="isActive" className="font-normal">Đang bán/Hoạt động</Label>
                      </div>
                  </CardContent>
                </Card>

                
                <Card>
                    <CardHeader>
                        <div className="flex items-center space-x-2">
                            <Checkbox id="isSchedulable" checked={isSchedulable} onCheckedChange={(checked) => setIsSchedulable(!!checked)} disabled={isSubmitting} />
                            <Label htmlFor="isSchedulable" className="text-lg font-semibold cursor-pointer">Có thể đặt lịch hẹn cho sản phẩm/dịch vụ này?</Label>
                        </div>
                         <CardDescription className="pl-6">Nếu được chọn, bạn có thể cấu hình các quy tắc đặt lịch riêng cho dịch vụ này. Nếu không, các cài đặt chung sẽ được áp dụng (nếu có).</CardDescription>
                    </CardHeader>
                    {isSchedulable && (
                        <CardContent className="space-y-4 pt-0 pl-6">
                            <Separator className="my-3"/>
                             <p className="text-xs text-muted-foreground">Để trống các trường dưới đây nếu muốn sử dụng cài đặt chung của toàn hệ thống cho dịch vụ này.</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="prodNumberOfStaff"><UsersIcon className="inline mr-1 h-4 w-4" />Số nhân viên riêng</Label>
                                    <Input id="prodNumberOfStaff" type="number" min="0" value={productSchedulingRules.numberOfStaff ?? ''} onChange={e => handleSchedulingRuleChange('numberOfStaff', e.target.value === '' ? undefined : parseFloat(e.target.value))} placeholder="Mặc định theo cài đặt chung" disabled={isSubmitting}/>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="prodServiceDuration"><ClockIcon className="inline mr-1 h-4 w-4" />Thời gian DV riêng (phút)</Label>
                                    <Input id="prodServiceDuration" type="number" min="5" value={productSchedulingRules.serviceDurationMinutes ?? ''} onChange={e => handleSchedulingRuleChange('serviceDurationMinutes', e.target.value === '' ? undefined : parseFloat(e.target.value))} placeholder="Mặc định theo cài đặt chung" disabled={isSubmitting}/>
                                </div>
                            </div>
                             <div className="space-y-1.5">
                                <Label htmlFor="prodWorkingHours"><ClockIcon className="inline mr-1 h-4 w-4" />Giờ nhận khách riêng (HH:MM, HH:MM)</Label>
                                <Input id="prodWorkingHours" value={(productSchedulingRules.workingHours || []).join(', ')} onChange={e => handleSchedulingRuleChange('workingHours', e.target.value.split(',').map(h => h.trim()).filter(h => /^[0-2][0-9]:[0-5][0-9]$/.test(h)))} placeholder="VD: 08:00,14:00 (Mặc định theo cài đặt chung)" disabled={isSubmitting}/>
                            </div>
                            <div className="space-y-1.5">
                                <Label><CalendarDays className="inline mr-1 h-4 w-4" />Ngày nghỉ hàng tuần riêng</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 mt-1">
                                {daysOfWeek.map(day => (
                                    <div key={`prodOffDay-${day.id}`} className="flex items-center space-x-2">
                                    <Checkbox id={`prodOffDay-${day.id}`} checked={(productSchedulingRules.weeklyOffDays || []).includes(day.id)} onCheckedChange={(checked) => handleProductWeeklyOffDayChange(day.id, checked)} disabled={isSubmitting}/>
                                    <Label htmlFor={`prodOffDay-${day.id}`} className="font-normal text-sm">{day.label}</Label>
                                    </div>
                                ))}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label><CalendarDays className="inline mr-1 h-4 w-4" />Ngày nghỉ Lễ/Đặc biệt riêng</Label>
                                <div className="flex gap-2 items-center">
                                    <Input type="date" value={tempProductOneTimeOffDate} onChange={e => setTempProductOneTimeOffDate(e.target.value)} className="max-w-xs h-9 text-sm" disabled={isSubmitting}/>
                                    <Button type="button" onClick={handleAddProductOneTimeOffDate} disabled={isSubmitting || !tempProductOneTimeOffDate} size="sm" className="h-9">Thêm</Button>
                                </div>
                                <ul className="mt-2 space-y-1 text-sm">
                                {(productSchedulingRules.oneTimeOffDates || []).map(date => (
                                    <li key={date} className="flex items-center justify-between p-1 bg-muted/50 rounded text-xs">
                                    {isValidDateFns(parse(date, 'yyyy-MM-dd', new Date())) ? format(parse(date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : 'Ngày không hợp lệ'}
                                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveProductOneTimeOffDate(date)} disabled={isSubmitting}>
                                        <Trash2 className="h-3 w-3 text-destructive" />
                                    </Button>
                                    </li>
                                ))}
                                </ul>
                            </div>
                            <Separator />
                            <div>
                                <h4 className="text-sm font-semibold mb-1">Quy tắc Ngày Cụ thể (Riêng cho DV này)</h4>
                                 <p className="text-xs text-muted-foreground mb-2">Ghi đè các quy tắc riêng của dịch vụ này cho một ngày nhất định. Nếu không có quy tắc ngày cụ thể ở đây, sẽ áp dụng quy tắc ngày cụ thể chung (nếu có), sau đó mới đến các quy tắc chung/riêng khác của dịch vụ.</p>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-2 border rounded-md mb-3 items-end">
                                    <Input type="date" value={tempProductSpecRuleDate} onChange={e => setTempProductSpecRuleDate(e.target.value)} placeholder="Ngày" className="h-8 text-xs"/>
                                    <Input value={tempProductSpecRuleHours} onChange={e => setTempProductSpecRuleHours(e.target.value)} placeholder="Giờ làm (HH:MM,)" className="h-8 text-xs"/>
                                    <Input type="number" value={tempProductSpecRuleStaff} onChange={e => setTempProductSpecRuleStaff(e.target.value)} placeholder="Số NV" className="h-8 text-xs"/>
                                    <Input type="number" value={tempProductSpecRuleDuration} onChange={e => setTempProductSpecRuleDuration(e.target.value)} placeholder="TG DV (phút)" className="h-8 text-xs"/>
                                    <div className="flex items-center space-x-2"><Checkbox id="tempProdSpecRuleIsOff" checked={tempProductSpecRuleIsOff} onCheckedChange={checked => setIsSchedulable(!!checked)} /><Label htmlFor="tempProdSpecRuleIsOff" className="text-xs">Ngày nghỉ</Label></div>
                                    <Button type="button" onClick={handleAddProductSpecificDayRule} size="xs" className="h-8 text-xs"><PlusCircle className="mr-1 h-3 w-3"/>Thêm</Button>
                                </div>
                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                {(productSchedulingRules.specificDayRules || []).map((rule, index) => (
                                <Card key={rule.id || index} className="p-2 bg-muted/30 text-xs">
                                    <div className="flex justify-between items-start mb-1">
                                        <p className="font-semibold">Ngày: {isValidDateFns(parse(rule.date, 'yyyy-MM-dd', new Date())) ? format(parse(rule.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : 'Ngày không hợp lệ'}</p>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => handleRemoveProductSpecificDayRule(rule.id!)} className="h-5 w-5"><Trash2 className="h-3 w-3 text-destructive"/></Button>
                                    </div>
                                    <p>Nghỉ: {rule.isOff ? 'Có' : 'Không'}</p>
                                    {rule.workingHours && <p>Giờ: {rule.workingHours.join(', ')}</p>}
                                    {rule.numberOfStaff !== undefined && <p>Số NV: {rule.numberOfStaff}</p>}
                                    {rule.serviceDurationMinutes !== undefined && <p>TG DV: {rule.serviceDurationMinutes} phút</p>}
                                </Card>
                                ))}
                                </div>
                            </div>
                        </CardContent>
                    )}
                </Card>
              </div>
            </ScrollArea>
            <DialogFooter className="pt-4 border-t mt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline" disabled={isSubmitting}>
                  Hủy
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="mr-2 h-4 w-4" />
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

