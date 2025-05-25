// src/app/staff/products/add/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProductForm } from '@/components/products/ProductForm';
import { createProduct } from '@/app/actions';
import type { ProductItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function AddProductPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (productData: Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt'>) => {
    setIsSubmitting(true);
    try {
      await createProduct(productData);
      toast({ title: 'Thành công', description: 'Sản phẩm mới đã được tạo.' });
      router.push('/staff/products');
    } catch (error: any) {
      toast({
        title: 'Lỗi',
        description: error.message || 'Không thể tạo sản phẩm mới.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push('/staff/products');
  };

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Thêm Sản phẩm/Dịch vụ Mới</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Điền thông tin chi tiết cho sản phẩm hoặc dịch vụ mới.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/staff/products">
            <ArrowLeft className="mr-2 h-4 w-4" /> Quay lại Danh sách
          </Link>
        </Button>
      </div>
      <div className="flex-grow overflow-hidden">
        <ProductForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isSubmitting={isSubmitting}
          formType="add"
        />
      </div>
    </div>
  );
}
