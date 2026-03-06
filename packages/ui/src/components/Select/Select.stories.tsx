import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { fn } from '@storybook/test';
import { Select } from './Select';

const meta: Meta<typeof Select> = {
    title: 'UI/Select',
    component: Select,
    tags: ['autodocs'],
    args: {
        onChange: fn(),
    },
};

export default meta;
type Story = StoryObj<typeof Select>;

const colorOptions = [
    { label: 'Red', value: 'red' },
    { label: 'Green', value: 'green' },
    { label: 'Blue', value: 'blue' },
    { label: 'Yellow', value: 'yellow' },
    { label: 'Purple', value: 'purple' },
];

export const Default: Story = {
    args: {
        options: colorOptions,
        placeholder: 'Select a color',
    },
    render: function Render(args) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [value, setValue] = useState<string | number | undefined>(args.value);
        return (
            <div className="w-[300px]">
                <Select
                    {...args}
                    value={value}
                    onChange={(val) => {
                        setValue(val);
                        args.onChange(val);
                    }}
                />
            </div>
        );
    }
};

export const Disabled: Story = {
    args: {
        options: colorOptions,
        placeholder: 'Cannot select',
        disabled: true,
    },
    render: function Render(args) {
        return (
            <div className="w-[300px]">
                <Select {...args} />
            </div>
        );
    }
};

export const Preselected: Story = {
    args: {
        options: colorOptions,
        value: 'blue',
    },
    render: function Render(args) {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [value, setValue] = useState<string | number | undefined>(args.value);
        return (
            <div className="w-[300px]">
                <Select
                    {...args}
                    value={value}
                    onChange={(val) => {
                        setValue(val);
                        args.onChange(val);
                    }}
                />
            </div>
        );
    }
};
