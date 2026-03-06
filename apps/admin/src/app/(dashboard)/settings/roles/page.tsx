'use client';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/auth';
import { rolesApi } from '@/lib/api';
import { Shield, Users, Plus, Trash2, Edit2, Check, X, ShieldAlert } from 'lucide-react';
import { Role, StaffMember } from '@/types';

export default function RolesPage() {
    const { store } = useAuthStore();
    const qc = useQueryClient();
    const [activeTab, setActiveTab] = useState<'roles' | 'staff'>('roles');
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const rolesQuery = useQuery<Role[]>({
        queryKey: ['roles', store?.id],
        queryFn: () => rolesApi.listRoles(store!.id),
        enabled: !!store,
    });

    const staffQuery = useQuery<StaffMember[]>({
        queryKey: ['staff', store?.id],
        queryFn: () => rolesApi.listStaff(store!.id),
        enabled: !!store,
    });

    const permissionsQuery = useQuery<string[]>({
        queryKey: ['permissions'],
        queryFn: () => rolesApi.listPermissions(),
    });

    const createRoleMutation = useMutation({
        mutationFn: (data: { name: string; description?: string; permissions: string[] }) => rolesApi.createRole(store!.id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['roles', store?.id] });
            setIsCreating(false);
        },
    });

    const updateRoleMutation = useMutation({
        mutationFn: (data: { id: string; name: string; description?: string; permissions: string[] }) => rolesApi.updateRole(store!.id, data.id, data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['roles', store?.id] });
            setEditingRole(null);
        },
    });

    const deleteRoleMutation = useMutation({
        mutationFn: (roleId: string) => rolesApi.deleteRole(store!.id, roleId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['roles', store?.id] }),
    });

    const updateStaffMutation = useMutation({
        mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
            rolesApi.updateStaffRole(store!.id, userId, roleId),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['staff', store?.id] }),
    });

    if (!store) return null;

    return (
        <div className="p-8 max-w-6xl">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Roles & Permissions</h1>
                    <p className="text-gray-500 text-sm mt-1">Manage staff access levels and custom roles.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('roles')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'roles' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Shield className="w-4 h-4 inline-block mr-2" />
                        Roles
                    </button>
                    <button
                        onClick={() => setActiveTab('staff')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'staff' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Users className="w-4 h-4 inline-block mr-2" />
                        Staff
                    </button>
                </div>
            </div>

            {activeTab === 'roles' ? (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-semibold text-gray-900">Configured Roles</h2>
                        {!isCreating && (
                            <button
                                onClick={() => setIsCreating(true)}
                                className="btn-primary flex items-center gap-2 py-2"
                            >
                                <Plus className="w-4 h-4" />
                                Create Role
                            </button>
                        )}
                    </div>

                    {(isCreating || editingRole) && (
                        <RoleForm
                            initialData={editingRole}
                            permissions={permissionsQuery.data || []}
                            onSubmit={(data) => {
                                if (editingRole) {
                                    updateRoleMutation.mutate({ ...data, id: editingRole.id });
                                } else {
                                    createRoleMutation.mutate(data);
                                }
                            }}
                            onCancel={() => {
                                setIsCreating(false);
                                setEditingRole(null);
                            }}
                            isPending={createRoleMutation.isPending || updateRoleMutation.isPending}
                        />
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {rolesQuery.data?.map((role: any) => (
                            <div key={role.id} className="card p-6 flex flex-col group relative">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="bg-primary-50 p-2 rounded-lg">
                                        <Shield className="w-6 h-6 text-primary-600" />
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {!role.isStatic && (
                                            <>
                                                <button
                                                    onClick={() => setEditingRole(role)}
                                                    className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 transition-colors"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (confirm(`Are you sure you want to delete the "${role.name}" role?`)) {
                                                            deleteRoleMutation.mutate(role.id);
                                                        }
                                                    }}
                                                    className="p-1.5 hover:bg-red-50 rounded-md text-red-500 transition-colors"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                        {role.name}
                                        {role.isStatic && (
                                            <span className="text-[10px] uppercase tracking-wider bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold">
                                                Built-in
                                            </span>
                                        )}
                                    </h3>
                                    <p className="text-sm text-gray-500 h-10 overflow-hidden line-clamp-2 mt-1">
                                        {role.description || 'No description provided.'}
                                    </p>
                                </div>

                                <div className="mt-auto">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">
                                        Permissions ({role.permissions.length})
                                    </p>
                                    <div className="flex flex-wrap gap-1.5 min-h-[50px]">
                                        {role.permissions.slice(0, 3).map((p: any) => (
                                            <span key={p.id} className="text-[11px] bg-gray-50 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">
                                                {p.action}
                                            </span>
                                        ))}
                                        {role.permissions.length > 3 && (
                                            <span className="text-[11px] text-gray-400 py-0.5">+ {role.permissions.length - 3} more</span>
                                        )}
                                        {role.permissions.length === 0 && <span className="text-[11px] text-gray-400 italic">No permissions assigned</span>}
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                                    <div className="flex items-center text-xs text-gray-500">
                                        <Users className="w-3 h-3 mr-1.5" />
                                        {role._count.users} staff members
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="card overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff Member</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Role</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Activity</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {staffQuery.data?.map((person: any) => (
                                <tr key={person.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <div className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold border-2 border-white shadow-sm mr-3">
                                                {person.name[0]}
                                            </div>
                                            <div>
                                                <div className="text-sm font-semibold text-gray-900">{person.name}</div>
                                                <div className="text-xs text-gray-500">{person.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-800 border border-blue-100">
                                            {person.role.name}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {person.lastLoginAt ? new Date(person.lastLoginAt).toLocaleDateString() : 'Never'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <select
                                            className="bg-white border border-gray-300 rounded-md text-xs py-1 px-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                                            value={person.role.id}
                                            onChange={(e) => updateStaffMutation.mutate({ userId: person.id, roleId: e.target.value })}
                                            disabled={updateStaffMutation.isPending}
                                        >
                                            {rolesQuery.data?.map((r: any) => (
                                                <option key={r.id} value={r.id}>
                                                    Assign {r.name}
                                                </option>
                                            ))}
                                        </select>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

interface RoleFormProps {
    initialData: Role | null;
    permissions: string[];
    onSubmit: (data: { name: string; description: string; permissions: string[] }) => void;
    onCancel: () => void;
    isPending: boolean;
}

function RoleForm({ initialData, permissions, onSubmit, onCancel, isPending }: RoleFormProps) {
    const [name, setName] = useState(initialData?.name || '');
    const [description, setDescription] = useState(initialData?.description || '');
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
        initialData?.permissions.map((p) => p.action) || []
    );

    const togglePermission = (action: string) => {
        setSelectedPermissions((prev) =>
            prev.includes(action) ? prev.filter((a) => a !== action) : [...prev, action]
        );
    };

    const hasWildcard = selectedPermissions.includes('*:*');

    return (
        <div className="card p-8 border-2 border-primary-100 bg-primary-50/10 mb-8 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary-600 rounded-lg shadow-lg shadow-primary-200">
                    <Edit2 className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                    {initialData ? `Edit Role: ${initialData.name}` : 'Create New Custom Role'}
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                    <div>
                        <label className="label">Role Name</label>
                        <input
                            className="input bg-white"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Content Editor"
                        />
                    </div>
                    <div>
                        <label className="label">Description (Optional)</label>
                        <textarea
                            className="input bg-white resize-none"
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Can manage pages and blog posts but cannot touch settings..."
                        />
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                        <h4 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-amber-500" />
                            Wildcard Overrides
                        </h4>
                        <div
                            onClick={() => togglePermission('*:*')}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${hasWildcard
                                ? 'bg-amber-50 border-amber-500 shadow-sm'
                                : 'bg-white border-gray-200 hover:border-amber-300'
                                }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${hasWildcard ? 'bg-amber-500' : 'bg-gray-100'}`}>
                                        <Shield className={`w-5 h-5 ${hasWildcard ? 'text-white' : 'text-gray-400'}`} />
                                    </div>
                                    <div>
                                        <p className={`font-bold text-sm ${hasWildcard ? 'text-amber-900' : 'text-gray-700'}`}>Full Admin (*:*)</p>
                                        <p className="text-xs text-amber-700/70">Grants all permissions. Use with caution.</p>
                                    </div>
                                </div>
                                {hasWildcard ? <Check className="w-5 h-5 text-amber-600" /> : <X className="w-5 h-5 text-gray-300" />}
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="label mb-3">Resource Permissions</label>
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="max-h-[400px] overflow-y-auto p-4 space-y-4">
                            {['products', 'orders', 'tickets', 'pages', 'settings', 'vendors', 'b2b'].map((resource) => (
                                <div key={resource} className="space-y-2">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{resource}</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['read', 'write', '*'].map((action) => {
                                            const perm = `${resource}:${action}`;
                                            const isSelected = selectedPermissions.includes(perm);
                                            const isDisabled = hasWildcard && perm !== '*:*';

                                            return (
                                                <button
                                                    key={perm}
                                                    disabled={isDisabled}
                                                    onClick={() => togglePermission(perm)}
                                                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold border-2 transition-all ${isSelected
                                                        ? 'bg-primary-50 border-primary-500 text-primary-900'
                                                        : 'bg-white border-gray-100 text-gray-600 hover:border-primary-200 disabled:opacity-30 disabled:hover:border-gray-100'
                                                        }`}
                                                >
                                                    {perm}
                                                    {isSelected && <Check className="w-3.5 h-3.5" />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end gap-3">
                <button onClick={onCancel} className="btn-secondary px-6">
                    Cancel
                </button>
                <button
                    onClick={() => onSubmit({ name, description, permissions: selectedPermissions })}
                    disabled={isPending || !name}
                    className="btn-primary px-10 shadow-lg shadow-primary-200"
                >
                    {isPending ? 'Saving...' : initialData ? 'Update Role' : 'Create Role'}
                </button>
            </div>
        </div>
    );
}
