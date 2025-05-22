
// src/app/admin/products/edit/[productId]/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ProductForm } from '@/components/products/ProductForm';
import { getProductById, updateProduct } from '@/app/actions';
import type { ProductItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.productId as string;
  const { toast } = useToast();

  const [product, setProduct] = useState<ProductItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProduct = useCallback(async () => {
    if (!productId) {
        setError("ID sản phẩm không hợp lệ.");
        setIsLoading(false);
        return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const fetchedProduct = await getProductById(productId);
      if (fetchedProduct) {
        setProduct(fetchedProduct);
      } else {
        setError("Không tìm thấy sản phẩm.");
        toast({ title: 'Lỗi', description: 'Không tìm thấy sản phẩm với ID này.', variant: 'destructive' });
      }
    } catch (err) {
      console.error("Lỗi tải sản phẩm:", err);
      setError("Lỗi khi tải thông tin sản phẩm.");
      toast({ title: 'Lỗi', description: 'Không thể tải thông tin sản phẩm.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [productId, toast]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const handleSubmit = async (productData: Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    setIsSubmitting(true);
    try {
      await updateProduct(productId, productData);
      toast({ title: 'Thành công', description: 'Sản phẩm đã được cập nhật.' });
      router.push('/admin/products');
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể cập nhật sản phẩm.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/admin/products');
  };

  if (isLoading) {
    return (
        <div className="space-y-4">
            <Skeleton className="h-8 w-1/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-10 w-32" />
        </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h2 className="mt-4 text-xl font-semibold text-destructive">{error}</h2>
        <p className="text-muted-foreground">Vui lòng thử lại hoặc quay về trang danh sách.</p>
        <Button onClick={handleCancel} variant="outline" className="mt-4">
          Quay lại Danh sách
        </Button>
      </div>
    );
  }

  if (!product) {
    return <p className="text-center text-muted-foreground">Không tìm thấy sản phẩm.</p>; // Should be caught by error state
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Chỉnh sửa: {product.name}</h1>
                <p className="text-muted-foreground text-sm sm:text-base">Cập nhật thông tin chi tiết cho sản phẩm hoặc dịch vụ.</p>
            </div>
             <Button variant="outline" asChild>
                <Link href="/admin/products">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại Danh sách
                </Link>
            </Button>
        </div>
        <div className="flex-grow overflow-hidden">
            <ProductForm
              initialProductData={product}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
              isSubmitting={isSubmitting}
              formType="edit"
            />
        </div>
    </div>
  );
}
