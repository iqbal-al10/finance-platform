'use client'

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/layouts/AppLayout";
import { useToast } from "@/hooks/use-toast";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { AccessDenied } from "@/components/ui/access-denied";
import { UserFormModal } from "./components/UserFormModal";
import { formatDate } from "@/lib/utils";
import {
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Users,
  Shield,
  UserCheck,
  UserX,
  Mail,
  Store,
  Sparkles,
  Lock,
  Eye,
  X,
} from "lucide-react";

interface User {
  id: string;
  tenantUserId: string;
  name: string;
  email: string;
  avatar: string | null;
  status: string;
  userStatus: string;
  lastLoginAt: string | null;
  createdAt: string;
  role: { id: string; name: string; description: string };
  branch: { id: string; name: string; code: string } | null;
  joinedAt: string | null;
}

interface LimitInfo {
  current: number;
  limit: number;
  remaining: number;
  allowed: boolean;
}

interface PlanLimits {
  planName: string;
  planSlug: string;
  branches: LimitInfo;
  users: LimitInfo;
  products: LimitInfo;
}

const ALLOWED_ROLES = ["SUPER_ADMIN", "OWNER"];

const ROLE_STYLES: Record<string, { color: string; bg: string }> = {
  OWNER: { color: "text-purple-700", bg: "bg-purple-100" },
  MANAGER: { color: "text-blue-700", bg: "bg-blue-100" },
  CASHIER: { color: "text-green-700", bg: "bg-green-100" },
  STAFF: { color: "text-gray-700", bg: "bg-gray-100" },
};

// ============================================
// SUB-COMPONENT: UserAvatar
// ============================================
function UserAvatar({
  name,
  avatar,
  size = "md",
}: {
  name: string;
  avatar: string | null;
  size?: "md" | "lg";
}) {
  const [imageError, setImageError] = useState(false);
  const hasValidAvatar = avatar && avatar.trim() !== "" && !imageError;

  const sizeClasses = size === "lg" ? "w-16 h-16 text-2xl" : "w-10 h-10 text-base";

  if (hasValidAvatar) {
    return (
      <img
        src={avatar!}
        alt={name}
        className={`${sizeClasses} rounded-full object-cover bg-gray-100`}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <div className={`${sizeClasses} rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function UsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    userId: string;
    userName: string;
  }>({ isOpen: false, userId: "", userName: "" });

  // ============================================
  // DETAIL MODAL
  // ============================================
  const [detailUser, setDetailUser] = useState<User | null>(null);

  // ============================================
  // AUTH GUARD
  // ============================================
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }

    if (status === "authenticated") {
      const role = session?.user?.role || "";
      if (!ALLOWED_ROLES.includes(role)) {
        return;
      }
      fetchUsers();
      fetchPlanLimits();
    }
  }, [status, router, session]);

  // ============================================
  // FETCH USERS
  // ============================================
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users");
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching users:", error);
      setUsers([]);
      toast({
        title: "Gagal",
        description: "Gagal memuat data user",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchPlanLimits = async () => {
    try {
      const res = await fetch("/api/plan-limits/status");
      if (res.ok) {
        const data = await res.json();
        setPlanLimits(data);
      }
    } catch (error) {
      console.error("Error fetching plan limits:", error);
    }
  };

  // ============================================
  // HANDLE DELETE
  // ============================================
  const handleDelete = async () => {
    const { userId, userName } = deleteModal;
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok) {
        toast({
          title: "Berhasil",
          description: `User "${userName}" berhasil dinonaktifkan`,
          variant: "default",
        });
        setDeleteModal({ isOpen: false, userId: "", userName: "" });
        fetchUsers();
        fetchPlanLimits();
      } else {
        toast({
          title: "Gagal",
          description: data.error || "Gagal menonaktifkan user",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Gagal",
        description: "Terjadi kesalahan",
        variant: "destructive",
      });
    }
  };

  // ============================================
  // FILTER
  // ============================================
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !searchTerm ||
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = filterRole === "all" || u.role.name === filterRole;

    return matchesSearch && matchesRole;
  });

  // ============================================
  // STATS
  // ============================================
  const stats = {
    total: users.length,
    active: users.filter((u) => u.status === "ACTIVE").length,
    inactive: users.filter((u) => u.status === "INACTIVE").length,
    byRole: {
      OWNER: users.filter((u) => u.role.name === "OWNER").length,
      MANAGER: users.filter((u) => u.role.name === "MANAGER").length,
      CASHIER: users.filter((u) => u.role.name === "CASHIER").length,
      STAFF: users.filter((u) => u.role.name === "STAFF").length,
    },
  };

  const hasActiveOwner = users.some(
    (u) => u.role.name === "OWNER" && u.status === "ACTIVE"
  );

  // ============================================
  // LOADING
  // ============================================
  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // ACCESS DENIED
  // ============================================
  const userRole = session?.user?.role || "";
  if (!ALLOWED_ROLES.includes(userRole)) {
    return <AccessDenied allowedRoles={ALLOWED_ROLES} />
  }

  const usersLimitReached = planLimits?.users.allowed === false;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Pengguna</h1>
            <p className="text-sm text-gray-500">
              Kelola semua user dalam bisnis Anda
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {usersLimitReached && planLimits && (
              <>
                <div className="flex items-center gap-1.5 px-3 py-2 bg-orange-50 border border-orange-200 text-orange-700 rounded-lg text-sm">
                  <Lock className="w-4 h-4" />
                  <span>
                    Limit user tercapai ({planLimits.users.current}/{planLimits.users.limit})
                  </span>
                </div>
                <button
                  onClick={() => router.push("/subscription")}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                >
                  <Sparkles className="w-4 h-4" />
                  Upgrade Plan
                </button>
              </>
            )}

            <button
              onClick={() => {
                setEditData(null);
                setShowModal(true);
              }}
              disabled={usersLimitReached}
              title={
                usersLimitReached
                  ? "Limit user tercapai. Upgrade plan untuk menambah."
                  : undefined
              }
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-5 h-5" />
              Tambah Pengguna
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Users className="w-5 h-5" />}
            label="Total User"
            value={stats.total}
            color="blue"
          />
          <StatCard
            icon={<UserCheck className="w-5 h-5" />}
            label="Aktif"
            value={stats.active}
            color="green"
          />
          <StatCard
            icon={<UserX className="w-5 h-5" />}
            label="Nonaktif"
            value={stats.inactive}
            color="red"
          />
          <StatCard
            icon={<Shield className="w-5 h-5" />}
            label="Manager"
            value={stats.byRole.MANAGER}
            color="purple"
          />
        </div>

        {/* FILTERS */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100 flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama atau email..."
                className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Semua Role</option>
              <option value="OWNER">Owner</option>
              <option value="MANAGER">Manager</option>
              <option value="CASHIER">Kasir</option>
              <option value="STAFF">Staff</option>
            </select>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pengguna</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cabang</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Login Terakhir</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p>
                        {searchTerm || filterRole !== "all"
                          ? "Tidak ada user yang cocok"
                          : "Belum ada user"}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const roleStyle = ROLE_STYLES[user.role.name] || ROLE_STYLES.STAFF;
                    const isMe = user.id === session?.user?.id;

                    return (
                      <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <UserAvatar name={user.name} avatar={user.avatar} />
                            <div>
                              <p className="font-medium text-gray-900 flex items-center gap-2">
                                {user.name}
                                {isMe && (
                                  <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                                    Anda
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                {user.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full ${roleStyle.bg} ${roleStyle.color}`}>
                            <Shield className="w-3 h-3" />
                            {user.role.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {user.branch ? (
                            <span className="flex items-center gap-1">
                              <Store className="w-3.5 h-3.5 text-gray-400" />
                              {user.branch.name}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            user.status === "ACTIVE"
                              ? "bg-green-100 text-green-700"
                              : user.status === "INACTIVE"
                                ? "bg-yellow-100 text-yellow-700"
                                : "bg-red-100 text-red-700"
                          }`}>
                            {user.status === "ACTIVE" ? "Aktif" : user.status === "INACTIVE" ? "Nonaktif" : "Suspend"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Belum pernah"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* DETAIL — tombol baru */}
                            <button
                              onClick={() => setDetailUser(user)}
                              className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-gray-100 transition-colors"
                              title="Lihat detail"
                            >
                              <Eye className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                              onClick={() => {
                                setEditData(user);
                                setShowModal(true);
                              }}
                              className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-blue-50 transition-colors"
                              title="Edit user"
                            >
                              <Edit className="w-4 h-4 text-blue-600" />
                            </button>
                            {!isMe && (
                              <button
                                onClick={() =>
                                  setDeleteModal({
                                    isOpen: true,
                                    userId: user.id,
                                    userName: user.name,
                                  })
                                }
                                className="p-1.5 bg-white rounded-lg shadow-sm hover:bg-red-50 transition-colors"
                                title="Nonaktifkan user"
                              >
                                <Trash2 className="w-4 h-4 text-red-600" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FORM MODAL */}
      <UserFormModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditData(null);
        }}
        onSuccess={() => {
          fetchUsers();
          fetchPlanLimits();
        }}
        editData={editData}
        hasOwner={hasActiveOwner}
        currentUserId={session?.user?.id}
      />

      {/* DELETE CONFIRMATION */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() =>
          setDeleteModal({ isOpen: false, userId: "", userName: "" })
        }
        onConfirm={handleDelete}
        title="Nonaktifkan Pengguna"
        message={`Apakah Anda yakin ingin menonaktifkan user "${deleteModal.userName}"?`}
        description="User yang dinonaktifkan tidak dapat login sampai diaktifkan kembali."
        confirmText="Ya, Nonaktifkan"
        cancelText="Batal"
        variant="danger"
      />

      {/* DETAIL MODAL */}
      {detailUser && (
        <div className="fixed inset-0 z-[70] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => setDetailUser(null)}
            ></div>

            <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Detail Pengguna</h2>
                <button
                  onClick={() => setDetailUser(null)}
                  className="p-1 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              <div className="flex items-center gap-4 mb-4">
                <UserAvatar name={detailUser.name} avatar={detailUser.avatar} size="lg" />
                <div>
                  <p className="font-semibold text-gray-900 text-lg">{detailUser.name}</p>
                  <p className="text-sm text-gray-500">{detailUser.email}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Role</span>
                  <span className="font-medium text-gray-900">{detailUser.role.name}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Cabang</span>
                  <span className="font-medium text-gray-900">
                    {detailUser.branch?.name || 'Semua Cabang'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Status</span>
                  <span className="font-medium text-gray-900">
                    {detailUser.status === 'ACTIVE' ? 'Aktif' : detailUser.status === 'INACTIVE' ? 'Nonaktif' : 'Suspend'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Login Terakhir</span>
                  <span className="font-medium text-gray-900">
                    {detailUser.lastLoginAt ? formatDate(detailUser.lastLoginAt) : 'Belum pernah'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-100">
                  <span className="text-gray-500">Bergabung</span>
                  <span className="font-medium text-gray-900">
                    {detailUser.joinedAt ? formatDate(detailUser.joinedAt) : '-'}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Dibuat</span>
                  <span className="font-medium text-gray-900">
                    {formatDate(detailUser.createdAt)}
                  </span>
                </div>
              </div>

              <div className="mt-6">
                <button
                  onClick={() => setDetailUser(null)}
                  className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

// ============================================
// SUB-COMPONENT: StatCard
// ============================================
function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: "blue" | "green" | "red" | "purple";
}) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${colors[color]}`}>{icon}</div>
      </div>
    </div>
  );
}
