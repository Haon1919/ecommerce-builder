'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Tag, ShoppingCart, Users, BadgePercent, Gift, Calendar, ArrowRight, Zap, Info, Settings2 } from 'lucide-react';

interface Condition {
    id: string;
    type: 'MIN_CART_VALUE' | 'CUSTOMER_TAG';
    value: string;
}

interface Promotion {
    id?: string;
    code: string;
    description: string;
    type: 'PERCENTAGE' | 'FIXED_AMOUNT' | 'BUY_X_GET_Y';
    value: number;
    priority: number;
    combinable: boolean;
    active: boolean;
    startDate?: string;
    endDate?: string;
    // BOGO specific
    buyQuantity?: number;
    getQuantity?: number;
    buyProductId?: string;
    getProductId?: string;
    conditions: Condition[];
}

interface PromotionBuilderProps {
    initialData?: Promotion;
    onSave: (promo: Promotion) => void;
    isSaving: boolean;
}

export function PromotionBuilder({ initialData, onSave, isSaving }: PromotionBuilderProps) {
    const [promo, setPromo] = useState<Promotion>(initialData || {
        code: '',
        description: '',
        type: 'PERCENTAGE',
        value: 10,
        priority: 0,
        combinable: false,
        active: true,
        conditions: [],
    });

    const addCondition = () => {
        setPromo({
            ...promo,
            conditions: [...promo.conditions, { id: Math.random().toString(36).substr(2, 9), type: 'MIN_CART_VALUE', value: '100' }]
        });
    };

    const removeCondition = (id: string) => {
        setPromo({
            ...promo,
            conditions: promo.conditions.filter(c => c.id !== id)
        });
    };

    const updateCondition = (id: string, updates: Partial<Condition>) => {
        setPromo({
            ...promo,
            conditions: promo.conditions.map(c => c.id === id ? { ...c, ...updates } : c)
        });
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* 1. Basic Info */}
            <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Info className="text-primary-500" size={20} /> Basic Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <label className="block text-sm font-semibold text-gray-700">Coupon Code (Optional)</label>
                        <div className="relative group">
                            <Tag className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary-500 transition-colors" size={18} />
                            <input
                                type="text"
                                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary-500 transition-all font-mono uppercase placeholder:text-gray-300"
                                placeholder="e.g. SUMMER25"
                                value={promo.code}
                                onChange={e => setPromo({ ...promo, code: e.target.value.toUpperCase() })}
                            />
                        </div>
                        <p className="text-xs text-gray-400 pl-2 italic">Leave blank to auto-apply to eligible carts.</p>
                    </div>

                    <div className="space-y-4">
                        <label className="block text-sm font-semibold text-gray-700">Display Description</label>
                        <textarea
                            className="w-full px-4 py-4 rounded-2xl bg-gray-50 border-none focus:ring-2 focus:ring-primary-500 transition-all min-h-[100px] placeholder:text-gray-300"
                            placeholder="Tell your customers about this offer..."
                            value={promo.description}
                            onChange={e => setPromo({ ...promo, description: e.target.value })}
                        />
                    </div>
                </div>
            </section>

            {/* 2. Visual Rule Builder (IF -> THEN) */}
            <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary-50 rounded-full -translate-y-1/2 translate-x-1/2 -z-10 blur-3xl opacity-30" />

                <h2 className="text-xl font-bold mb-8 flex items-center gap-2">
                    <Zap className="text-yellow-500 fill-yellow-500" size={20} /> Promotion Logic
                </h2>

                {/* IF CONDITIONS */}
                <div className="space-y-6">
                    <div className="flex items-center gap-4">
                        <div className="h-px flex-1 bg-gray-100" />
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest px-4 border border-gray-100 rounded-full py-1">IF</span>
                        <div className="h-px flex-1 bg-gray-100" />
                    </div>

                    <div className="space-y-4">
                        {promo.conditions.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/50">
                                <p className="text-gray-400 text-sm">Always apply this promotion (global offer).</p>
                            </div>
                        ) : (
                            promo.conditions.map((condition, idx) => (
                                <div key={condition.id} className="flex items-center gap-4 animate-in slide-in-from-left-4 duration-300" style={{ animationDelay: `${idx * 50}ms` }}>
                                    <select
                                        className="bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm font-semibold focus:ring-2 focus:ring-primary-500 transition-all"
                                        value={condition.type}
                                        onChange={e => updateCondition(condition.id, { type: e.target.value as any })}
                                    >
                                        <option value="MIN_CART_VALUE">Subtotal is at least</option>
                                        <option value="CUSTOMER_TAG">Customer has tag</option>
                                    </select>

                                    <div className="flex-1 relative">
                                        <input
                                            type={condition.type === 'MIN_CART_VALUE' ? 'number' : 'text'}
                                            className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 text-sm font-medium focus:ring-2 focus:ring-primary-500 transition-all"
                                            placeholder={condition.type === 'MIN_CART_VALUE' ? '100.00' : 'e.g. VIP'}
                                            value={condition.value}
                                            onChange={e => updateCondition(condition.id, { value: e.target.value })}
                                        />
                                        {condition.type === 'MIN_CART_VALUE' && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>}
                                    </div>

                                    <button
                                        onClick={() => removeCondition(condition.id)}
                                        className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))
                        )}

                        <button
                            onClick={addCondition}
                            className="w-full py-4 border-2 border-dashed border-primary-100 rounded-3xl text-primary-600 font-bold text-sm hover:border-primary-500 hover:bg-primary-50 transition-all flex items-center justify-center gap-2 group"
                        >
                            <Plus className="group-hover:rotate-90 transition-transform" size={18} /> Add Requirement
                        </button>
                    </div>

                    {/* THEN ACTION */}
                    <div className="flex items-center gap-4 mt-12">
                        <div className="h-px flex-1 bg-gray-100" />
                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest px-4 border border-gray-100 rounded-full py-1">THEN</span>
                        <div className="h-px flex-1 bg-gray-100" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 bg-gray-50/50 p-8 rounded-3xl border border-primary-50 border-dashed">
                        <div className="space-y-4">
                            <label className="block text-sm font-bold text-gray-700">Reward Type</label>
                            <div className="grid grid-cols-2 gap-2">
                                {[
                                    { id: 'PERCENTAGE', label: 'Percent Off', icon: BadgePercent },
                                    { id: 'FIXED_AMOUNT', label: 'Fixed $ Off', icon: Tag },
                                    { id: 'BUY_X_GET_Y', label: 'Buy X Get Y', icon: Gift },
                                ].map(type => (
                                    <button
                                        key={type.id}
                                        onClick={() => setPromo({ ...promo, type: type.id as any })}
                                        className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${promo.type === type.id
                                            ? 'bg-primary-600 border-primary-600 text-white shadow-lg shadow-primary-200'
                                            : 'bg-white border-transparent text-gray-500 hover:border-gray-200'
                                            }`}
                                    >
                                        <type.icon size={20} />
                                        <span className="text-sm font-bold">{type.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4 flex flex-col justify-center">
                            {promo.type === 'BUY_X_GET_Y' ? (
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-400">Buy</span>
                                        <input type="number" className="w-16 bg-gray-50 border-none rounded-lg py-1 px-2 text-sm font-bold" value={promo.buyQuantity || 1} onChange={e => setPromo({ ...promo, buyQuantity: parseInt(e.target.value) })} />
                                        <span className="text-xs font-bold text-gray-400">of item</span>
                                        <input type="text" className="flex-1 bg-gray-50 border-none rounded-lg py-1 px-2 text-sm" placeholder="Product ID" value={promo.buyProductId || ''} onChange={e => setPromo({ ...promo, buyProductId: e.target.value })} />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-400">Get</span>
                                        <input type="number" className="w-16 bg-gray-50 border-none rounded-lg py-1 px-2 text-sm font-bold" value={promo.getQuantity || 1} onChange={e => setPromo({ ...promo, getQuantity: parseInt(e.target.value) })} />
                                        <span className="text-xs font-bold text-gray-400">of item</span>
                                        <input type="text" className="flex-1 bg-gray-50 border-none rounded-lg py-1 px-2 text-sm" placeholder="Product ID" value={promo.getProductId || ''} onChange={e => setPromo({ ...promo, getProductId: e.target.value })} />
                                        <span className="text-xs font-bold text-gray-400 text-green-600">FREE</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex items-center justify-between">
                                    <div>
                                        <span className="text-xs font-black text-gray-400 uppercase">Discount Value</span>
                                        <input
                                            type="number"
                                            className="block text-4xl font-black bg-transparent border-none p-0 focus:ring-0 w-full"
                                            value={promo.value}
                                            onChange={e => setPromo({ ...promo, value: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                    <div className="text-4xl font-black text-primary-200">
                                        {promo.type === 'PERCENTAGE' ? '%' : '$'}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. Scheduling & Advanced */}
            <section className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row gap-8">
                    <div className="flex-1 space-y-6 border-r border-gray-50 pr-8">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Calendar className="text-primary-500" size={20} /> Validity Period
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Starts</label>
                                <input
                                    type="datetime-local"
                                    className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500"
                                    value={promo.startDate ? promo.startDate.substring(0, 16) : ''}
                                    onChange={e => setPromo({ ...promo, startDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase mb-2">Ends</label>
                                <input
                                    type="datetime-local"
                                    className="w-full bg-gray-50 border-none rounded-2xl py-3 px-4 focus:ring-2 focus:ring-primary-500"
                                    value={promo.endDate ? promo.endDate.substring(0, 16) : ''}
                                    onChange={e => setPromo({ ...promo, endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="w-full md:w-64 space-y-6">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Settings2 className="text-primary-500" size={20} /> Advanced
                        </h2>

                        <div className="space-y-4">
                            <label className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl cursor-pointer hover:bg-gray-100 transition-colors">
                                <span className="text-sm font-bold text-gray-700">Combinable</span>
                                <input
                                    type="checkbox"
                                    className="w-5 h-5 rounded text-primary-500 focus:ring-primary-500 border-gray-300 transition-all"
                                    checked={promo.combinable}
                                    onChange={e => setPromo({ ...promo, combinable: e.target.checked })}
                                />
                            </label>

                            <div className="p-4 bg-gray-50 rounded-2xl space-y-2">
                                <span className="text-xs font-bold text-gray-400 uppercase">Priority</span>
                                <input
                                    type="number"
                                    className="w-full bg-transparent border-none p-0 focus:ring-0 font-bold text-lg"
                                    value={promo.priority}
                                    onChange={e => setPromo({ ...promo, priority: parseInt(e.target.value) })}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* FOOTER ACTION */}
            <div className="flex justify-end gap-4 p-4 sticky bottom-8 bg-white/80 backdrop-blur-xl rounded-3xl border border-gray-100 shadow-2xl z-50 animate-in slide-in-from-bottom-8 duration-700 delay-300">
                <button className="px-8 py-3 rounded-2xl font-bold text-gray-400 hover:text-gray-900 transition-colors">
                    Discard Changes
                </button>
                <button
                    onClick={() => onSave(promo)}
                    disabled={isSaving}
                    className="btn-primary px-12 py-3 rounded-2xl font-black flex items-center gap-3 min-w-[200px] justify-center"
                >
                    {isSaving ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>Save Promotion <ArrowRight size={20} /></>
                    )}
                </button>
            </div>
        </div>
    );
}
