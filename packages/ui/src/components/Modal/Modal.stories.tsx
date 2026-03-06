import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { userEvent, within, expect, fn } from '@storybook/test';
import { Modal } from './Modal';

const meta: Meta<typeof Modal> = {
    title: 'UI/Modal',
    component: Modal,
    tags: ['autodocs'],
    args: {
        onClose: fn(),
    },
};

export default meta;
type Story = StoryObj<typeof Modal>;

export const Default: Story = {
    args: {
        isOpen: true,
        title: 'Confirm Action',
        children: <p className="text-sm text-muted-foreground">Are you sure you want to completely erase this item? This action cannot be undone.</p>,
    },
};

export const WithoutCloseButton: Story = {
    args: {
        isOpen: true,
        title: 'Alert',
        hideCloseButton: true,
        children: (
            <div>
                <p className="mb-4">You have successfully completed the action.</p>
                <button className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm">
                    Acknowledge
                </button>
            </div>
        ),
    },
};

// Interactive story demonstrating state
export const Interactive: Story = {
    render: (args) => {
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [isOpen, setIsOpen] = useState(false);
        return (
            <div className="p-10 border rounded-lg border-dashed">
                <button
                    onClick={() => setIsOpen(true)}
                    className="bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium text-sm"
                    data-testid="open-modal-btn"
                >
                    Open Modal
                </button>
                <Modal {...args} isOpen={isOpen} onClose={() => setIsOpen(false)}>
                    <p>This is an interactive modal. Try closing it with the button, backdrop, or Escape key.</p>
                </Modal>
            </div>
        );
    },
    args: {
        title: 'Interactive Modal',
    },
    play: async ({ canvasElement, step }) => {
        const canvas = within(canvasElement);

        await step('Open modal', async () => {
            const openBtn = canvas.getByTestId('open-modal-btn');
            await userEvent.click(openBtn);
        });

        await step('Verify modal is open', async () => {
            // The modal portal might be mounted at body, so we query absolute document body
            const body = within(document.body);
            const dialog = await body.findByRole('dialog');
            await expect(dialog).toBeInTheDocument();
        });

        await step('Close modal', async () => {
            const body = within(document.body);
            const closeBtn = await body.findByLabelText('Close');
            await userEvent.click(closeBtn);
        });
    },
};
