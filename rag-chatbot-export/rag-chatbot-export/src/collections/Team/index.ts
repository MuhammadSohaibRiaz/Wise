import { CollectionConfig } from "payload";
import { revalidateTeam, revalidateDelete } from './hooks/revalidateTeam'
import { authenticated } from "../../access/authenticated";
import { authenticatedOrPublished } from "../../access/authenticatedOrPublished";
import { slugField } from '@/fields/slug'
import { syncToVectorDB, deleteFromVectorDB } from "@/hooks/syncToVectorDB";

export const Team: CollectionConfig = {
  slug: "team",
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  labels: {
    singular: "Team Member",
    plural: "Team Members",
  },
  admin: {
    defaultColumns: ["name", "role", "createdAt"],
    useAsTitle: "name",
  },
  fields: [
    {
      name: "name",
      type: "text",
      required: true,
      minLength: 1,
      maxLength: 100,
      admin: {
        description: "Full name of the team member",
      },
    },
    {
      name: "role",
      type: "text",
      required: true,
      maxLength: 100,
      admin: {
        description: "Job title or role in the team (e.g., Frontend Developer, Designer)",
      },
    },
    {
      name: "email",
      type: "email",
      required: false,
      unique: true,
      admin: {
        description: "Professional email address (will be kept unique)",
      },
    },
    {
      name: "skills",
      type: "array",
      admin: {
        description: "List of skills and expertise areas",
      },
      fields: [
        {
          name: "skill",
          type: "text",
          required: true,
          maxLength: 50,
        },
      ],
    },
    {
      name: "bio",
      type: "textarea",
      maxLength: 500,
      admin: {
        description: "Brief biography or description (max 500 characters)",
      },
    },
    {
      name: "photo",
      type: "upload",
      relationTo: "media",
      required: false,
      admin: {
        description: "Profile photo of the team member",
      },
    },
    {
      name: "socialLinks",
      type: "array",
      admin: {
        description: "Social media and professional profiles",
      },
      fields: [
        {
          name: "platform",
          type: "select",
          required: true,
          options: [
            { label: "Twitter", value: "twitter" },
            { label: "LinkedIn", value: "linkedin" },
            { label: "GitHub", value: "github" },
            { label: "Website", value: "website" },
            { label: "Instagram", value: "instagram" },
            { label: "Dribbble", value: "dribbble" },
            { label: "Behance", value: "behance" },
          ],
        },
        {
          name: "url",
          type: "text",
          required: true,
          validate: (value: unknown) => {
            if (!value) return true;
            const urlPattern = /^https?:\/\/.+/;
            if (!urlPattern.test(value as string)) {
              return "Please enter a valid URL starting with http:// or https://";
            }
            return true;
          },
          admin: {
            placeholder: "https://example.com/profile",
          },
        },
      ],
    },
    {
      name: "experience",
      type: "array",
      required: false,
      admin: {
        description: "Professional experience and work history",
      },
      fields: [
        {
          name: "company",
          type: "text",
          required: true,
          maxLength: 100,
          admin: {
            description: "Company or organization name",
          },
        },
        {
          name: "position",
          type: "text",
          required: true,
          maxLength: 100,
          admin: {
            description: "Job title or position held",
          },
        },
        {
          name: "startDate",
          type: "date",
          required: true,
          admin: {
            description: "Start date of employment",
            date: {
              pickerAppearance: "monthOnly",
            },
          },
        },
        {
          name: "isCurrent",
          type: "checkbox",
          defaultValue: false,
          admin: {
            description: "Check if this is your current position",
          },
        },
        {
          name: "endDate",
          type: "date",
          required: false,
          validate: (value: unknown, { siblingData }: any) => {
            if (siblingData?.isCurrent) return true;
            if (!value || !siblingData?.startDate) return true;
            const start = new Date(siblingData.startDate);
            const end = new Date(value as string);
            if (end < start) {
              return "End date must be after start date";
            }
            return true;
          },
          admin: {
            description: "End date of employment",
            condition: (data, siblingData) => !siblingData?.isCurrent,
            date: {
              pickerAppearance: "monthOnly",
            },
          },
        },
        {
          name: "description",
          type: "textarea",
          maxLength: 500,
          admin: {
            description: "Brief description of responsibilities and achievements",
          },
        },
        {
          name: "location",
          type: "text",
          maxLength: 100,
          admin: {
            description: "Work location (e.g., Remote, New York, USA)",
          },
        },
      ],
    },
    {
      name: "projects",
      type: "relationship",
      relationTo: "projects",
      hasMany: true,
      required: false,
      admin: {
        description: "Projects this team member has contributed to",
      },
    },
    ...slugField('name'),
  ],
    hooks: {
      afterChange: [
        revalidateTeam,
        syncToVectorDB,
      ],
    afterDelete: [revalidateDelete, deleteFromVectorDB],
  },
  versions: {
    drafts: {
      autosave: false,
      schedulePublish: true,
    },
    maxPerDoc: 50,
  },
};
