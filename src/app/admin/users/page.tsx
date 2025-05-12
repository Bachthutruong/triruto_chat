// src/app/admin/users/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import type { UserSession, UserRole } from '@/lib/types';
import { getAllUsers, createStaffOrAdminUser, updateUser, deleteUser } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);
  const [name, setName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<'admin' | 'staff' | ''>('');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const fetchedUsers = await getAllUsers();
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Không thể tải người dùng:", error);
      toast({ title: "Lỗi", description: "Không thể tải danh sách người dùng.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const resetForm = () => {
    setCurrentUser(null);
    setName('');
    setPhoneNumber('');
    setPassword('');
    setRole('');
    setShowPassword(false);
  };

  const handleOpenModal = (user: UserSession | null = null) => {
    resetForm();
    if (user) {
      setCurrentUser(user);
      setName(user.name || '');
      setPhoneNumber(user.phoneNumber);
      setRole(user.role === 'customer' ? '' : user.role);
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!role) {
        toast({ title: "Lỗi", description: "Vui lòng chọn vai trò.", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    try {
      if (currentUser) { // Editing user
        const updateData: Partial<Pick<UserSession, 'name' | 'role'> & { password?: string }> = {
          name,
          role: role as 'admin' | 'staff', // role is validated to be not ''
        };
        if (password) { // Only include password if it's being changed
          updateData.password = password;
        }
        await updateUser(currentUser.id, updateData);
        toast({ title: "Thành công", description: "Người dùng đã được cập nhật." });
      } else { // Creating new user
        if (!password) {
            toast({ title: "Lỗi", description: "Vui lòng nhập mật khẩu cho người dùng mới.", variant: "destructive" });
            setIsSubmitting(false);
            return;
        }
        await createStaffOrAdminUser(name, phoneNumber, role as 'admin' | 'staff', password);
        toast({ title: "Thành công", description: "Người dùng đã được tạo." });
      }
      resetForm();
      setIsModalOpen(false);
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Thao tác thất bại.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await deleteUser(userId);
      toast({ title: "Thành công", description: "Người dùng đã được xóa." });
      fetchUsers();
    } catch (error: any) {
      toast({ title: "Lỗi", description: error.message || "Không thể xóa người dùng.", variant: "destructive" });
    }
  };

  const getRoleName = (roleValue: UserSession['role']) => {
    if (roleValue === 'admin') return 'Quản trị';
    if (roleValue === 'staff') return 'Nhân viên';
    return 'Khách hàng'; // Should not happen for this page
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản lý Người dùng</h1>
          <p className="text-muted-foreground">Quản lý nhân viên và quản trị viên.</p>
        </div>
        <Button onClick={() => handleOpenModal()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Thêm Người dùng Mới
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Tất cả Người dùng (Nhân viên/Admin)</CardTitle>
          <CardDescription>Danh sách tất cả nhân viên và quản trị viên trong hệ thống.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Đang tải người dùng...</p>
          ) : users.length === 0 ? (
            <p>Không tìm thấy người dùng nào.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tên</TableHead>
                  <TableHead>Số điện thoại</TableHead>
                  <TableHead>Vai trò</TableHead>
                  <TableHead>ID Người dùng</TableHead>
                  <TableHead className="text-right">Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name || 'Chưa có'}</TableCell>
                    <TableCell>{user.phoneNumber}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        user.role === 'admin' ? 'bg-red-100 text-red-700' :
                        user.role === 'staff' ? 'bg-blue-100 text-blue-700' :
                        'bg-green-100 text-green-700' // Should not see 'customer' here
                      }`}>
                        {getRoleName(user.role)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{user.id}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="mr-2" onClick={() => handleOpenModal(user)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Bạn có chắc chắn muốn xóa?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Hành động này không thể hoàn tác. Người dùng "{user.name || user.phoneNumber}" sẽ bị xóa vĩnh viễn.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Hủy</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteUser(user.id)} className="bg-destructive hover:bg-destructive/90">Xóa</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{currentUser ? 'Sửa Người dùng' : 'Thêm Người dùng Mới'}</DialogTitle>
            <DialogDescription>
              {currentUser ? 'Cập nhật thông tin chi tiết cho người dùng.' : 'Tạo tài khoản nhân viên hoặc admin mới.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Họ và Tên</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nhập họ và tên" required disabled={isSubmitting} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Số điện thoại</Label>
                <Input id="phoneNumber" type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Nhập số điện thoại" required disabled={currentUser !== null || isSubmitting} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mật khẩu</Label>
                <div className="relative">
                    <Input 
                        id="password" 
                        type={showPassword ? "text" : "password"} 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        placeholder={currentUser ? "Để trống nếu không đổi" : "Nhập mật khẩu"} 
                        required={!currentUser} 
                        disabled={isSubmitting}
                    />
                    <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                        onClick={() => setShowPassword(!showPassword)}
                    >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Vai trò</Label>
                <Select value={role} onValueChange={(value) => setRole(value as 'admin' | 'staff')} disabled={isSubmitting}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Chọn một vai trò" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Nhân viên</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" disabled={isSubmitting}>Hủy</Button></DialogClose>
              <Button type="submit" disabled={isSubmitting}>{isSubmitting ? (currentUser ? 'Đang cập nhật...' : 'Đang tạo...') : (currentUser ? 'Lưu thay đổi' : 'Tạo Người dùng')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}