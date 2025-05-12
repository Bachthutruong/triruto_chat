'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2 } from 'lucide-react';
import type { UserSession } from '@/lib/types';
import { getAllUsers } from '@/app/actions'; 

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const fetchedUsers = await getAllUsers();
        setUsers(fetchedUsers);
      } catch (error) {
        console.error("Không thể tải người dùng:", error);
        // Thêm thông báo toast ở đây
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const getRoleName = (role: UserSession['role']) => {
    if (role === 'admin') return 'Quản trị';
    if (role === 'staff') return 'Nhân viên';
    return 'Khách hàng';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Quản lý Người dùng</h1>
          <p className="text-muted-foreground">Quản lý nhân viên, quản trị viên và xem vai trò khách hàng.</p>
        </div>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" /> Thêm Người dùng Mới
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Tất cả Người dùng</CardTitle>
          <CardDescription>Danh sách tất cả người dùng đã đăng ký trong hệ thống.</CardDescription>
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
                        'bg-green-100 text-green-700'
                      }`}>
                        {getRoleName(user.role)}
                      </span>
                    </TableCell>
                    <TableCell>{user.id}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" className="mr-2">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

