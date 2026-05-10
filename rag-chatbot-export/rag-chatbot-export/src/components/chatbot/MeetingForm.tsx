'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';

export interface MeetingData {
  name: string;
  email: string;
  datetime: string;
  timezone?: string;
  channel?: string;
  agenda?: string;
  date?: string;
  time?: string;
}

interface MeetingFormProps {
  onSubmit: (data: MeetingData) => Promise<void>;
  onCancel: () => void;
}

export function MeetingForm({ onSubmit, onCancel }: MeetingFormProps) {
  const [formData, setFormData] = useState<MeetingData>({
    name: '',
    email: '',
    datetime: '',
    date: '',
    time: '',
    timezone: '',
    channel: 'Zoom',
    agenda: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim() || !formData.email.trim() || !formData.date || !formData.time) {
      setError('Please fill in name, email, date, and time.');
      return;
    }

    const combined = `${formData.date} ${formData.time}`;

    setLoading(true);
    try {
      await onSubmit({ ...formData, datetime: combined });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit meeting request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
      <h3 className="font-semibold text-sm">Schedule a Meeting</h3>
      
      <div>
        <label className="text-xs font-medium">Name *</label>
        <Input
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Your full name"
          disabled={loading}
          className="mt-1"
        />
      </div>

      <div>
        <label className="text-xs font-medium">Email *</label>
        <Input
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="you@gmail.com"
          disabled={loading}
          className="mt-1"
        />
      </div>

        <div>
            <label className="text-xs font-medium">Preferred Date *</label>
            <Input
                name="date"
                type="date"
                value={formData.date}
                onChange={handleChange}
                disabled={loading}
                className="mt-1"
            />
        </div>

        <div>
            <label className="text-xs font-medium">Preferred Time *</label>
            <Input
                name="time"
                type="time"
                value={formData.time}
                onChange={handleChange}
                disabled={loading}
                className="mt-1"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
                PST will be used unless you specify a timezone below.
            </p>
        </div>

      <div>
        <label className="text-xs font-medium">Timezone</label>
        <Input
          name="timezone"
          type="text"
          value={formData.timezone}
          onChange={handleChange}
          placeholder="e.g., EST, PST, PKT"
          disabled={loading}
          className="mt-1"
        />
      </div>

      <div>
        <label className="text-xs font-medium">Meeting Channel</label>
        <select
          name="channel"
          value={formData.channel}
          onChange={handleChange}
          disabled={loading}
          className="w-full p-2 rounded border border-input bg-background mt-1 text-sm"
        >
          <option value="Zoom">Zoom</option>
          <option value="Google Meet">Google Meet</option>
          <option value="Teams">Microsoft Teams</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-medium">Agenda/Notes</label>
        <textarea
            name="agenda"
            value={formData.agenda}
            onChange={(e) => handleChange(e as any)}
            placeholder="Briefly describe what you'd like to discuss"
            disabled={loading}
            className="w-full p-2 rounded border border-input bg-background mt-1 text-sm min-h-[80px]"
        />
      </div>

      {error && <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">{error}</div>}

      <div className="flex gap-2 pt-2">
        <Button
          type="submit"
          disabled={loading}
          className="flex-1 h-8 text-xs"
        >
          {loading && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
          {loading ? 'Submitting...' : 'Confirm & Book'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={loading}
          onClick={onCancel}
          className="flex-1 h-8 text-xs"
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}