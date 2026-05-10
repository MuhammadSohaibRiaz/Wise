import { CollectionConfig } from "payload";
import { revalidateProject, revalidateDelete } from "./hooks/revalidateProject";
import { authenticated } from "../../access/authenticated";
import { authenticatedOrPublished } from "../../access/authenticatedOrPublished";
import { syncToVectorDB, deleteFromVectorDB } from "@/hooks/syncToVectorDB";
import { slugField } from "@/fields/slug";

export const Projects: CollectionConfig = {
  slug: "projects",
  access: {
    create: authenticated,
    delete: authenticated,
    read: authenticatedOrPublished,
    update: authenticated,
  },
  labels: {
    singular: "Project",
    plural: "Projects",
  },
  admin: {
    defaultColumns: ["title", "status", "createdAt"],
    useAsTitle: "title",
  },
  fields: [
    {
      name: "title",
      type: "text",
      required: true,
      minLength: 3,
      maxLength: 150,
      admin: {
        description: "Project name or title",
      },
    },
    ...slugField(),
    {
      name: "description",
      type: "textarea",
      required: true,
      minLength: 10,
      maxLength: 1000,
      admin: {
        description: "Detailed project description (10-1000 characters)",
      },
    },
    {
      name: "attachments",
      type: "upload",
      relationTo: "media",
      hasMany: true,
      admin: {
        description: "Project images, documents, or other media files",
      },
    },
    {
      name: "status",
      type: "select",
      required: true,
      options: [
        { label: "Planning", value: "planning" },
        { label: "In Progress", value: "in_progress" },
        { label: "On Hold", value: "on_hold" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "planning",
      admin: {
        description: "Current status of the project",
      },
    },
    {
      name: "priority",
      type: "select",
      options: [
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" },
        { label: "Critical", value: "critical" },
      ],
      defaultValue: "medium",
      admin: {
        description: "Project priority level",
      },
    },
    {
      name: "startDate",
      type: "date",
      required: true,
      admin: {
        description: "Project start date",
        date: {
          pickerAppearance: "dayOnly",
        },
      },
    },
    {
      name: "endDate",
      type: "date",
      validate: (value: unknown, { siblingData }: any) => {
        if (!value || !siblingData?.startDate) return true;
        const start = new Date(siblingData.startDate);
        const end = new Date(value as string);
        if (end < start) {
          return "End date must be after start date";
        }
        return true;
      },
      admin: {
        description: "Project end date (must be after start date)",
        date: {
          pickerAppearance: "dayOnly",
        },
      },
    },
    {
      name: "budget",
      type: "number",
      min: 0,
      admin: {
        description: "Project budget (optional)",
        placeholder: "0.00",
      },
    },
    {
      name: "tags",
      type: "array",
      admin: {
        description: "Tags or categories for the project",
      },
      fields: [
        {
          name: "tag",
          type: "text",
          required: true,
          maxLength: 30,
        },
      ],
    },
    // {
      // name: "heroImage",
      // type: "upload",
      // relationTo: "media",
      // admin: {
        // description: "Hero/Featured image for project detail page",
      // },
    // },
    {
      name: "thumbnail",
      type: "upload",
      relationTo: "media",
      admin: {
        description: "Thumbnail image for project listing",
      },
    },
    {
      name: "technologies",
      type: "array",
      admin: {
        description: "Technologies used in this project",
      },
      fields: [
        {
          name: "tech",
          type: "text",
          required: true,
        },
      ],
    },
    {
      name: "badge",
      type: "text",
      admin: {
        description: "Badge text (e.g., 'CASE STUDY: 2024')",
      },
    },
    {
      name: "client",
      type: "text",
      admin: {
        description: "Client name",
      },
    },
    {
      name: "duration",
      type: "text",
      admin: {
        description: "Project duration (e.g., '6 Months')",
      },
    },
    {
      name: "industry",
      type: "text",
      admin: {
        description: "Industry/sector",
      },
    },
    {
      name: "challenge",
      type: "textarea",
      admin: {
        description: "Project challenge description",
      },
    },
    {
      name: "solution",
      type: "array",
      admin: {
        description: "Solution points",
      },
      fields: [
        {
          name: "point",
          type: "text",
          required: true,
        },
      ],
    },
    {
      name: "impact",
      type: "array",
      admin: {
        description: "Project impact metrics",
      },
      fields: [
        {
          name: "metric",
          type: "text",
          required: true,
        },
        {
          name: "value",
          type: "text",
          required: true,
        },
      ],
    },
    {
      name: "techStack",
      type: "array",
      admin: {
        description: "Categorized tech stack",
      },
      fields: [
        {
          name: "category",
          type: "text",
          required: true,
        },
        {
          name: "technologies",
          type: "array",
          fields: [
            {
              name: "tech",
              type: "text",
              required: true,
            },
          ],
        },
      ],
    },
    {
      name: "testimonial",
      type: "group",
      admin: {
        description: "Client testimonial",
      },
      fields: [
        {
          name: "quote",
          type: "textarea",
        },
        {
          name: "author",
          type: "text",
        },
        {
          name: "role",
          type: "text",
        },
        {
          name: "rating",
          type: "number",
          min: 1,
          max: 5,
        },
      ],
    },
    {
      name: "liveUrl",
      type: "text",
      admin: {
        description: "Live project URL",
      },
    },
    {
      name: "coreTeam",
      type: "relationship",
      relationTo: "team",
      hasMany: true,
      admin: {
        description: "Core team members for this project",
      },
    },
    {
      name: "timeline",
      type: "array",
      admin: {
        description: "Project timeline phases",
      },
      fields: [
        {
          name: "phase",
          type: "text",
          required: true,
        },
        {
          name: "duration",
          type: "text",
        },
        {
          name: "description",
          type: "textarea",
        },
      ],
    },
    {
      name: "benchmarks",
      type: "array",
      admin: {
        description: "Performance benchmarks",
      },
      fields: [
        {
          name: "metric",
          type: "text",
          required: true,
        },
        {
          name: "before",
          type: "text",
        },
        {
          name: "after",
          type: "text",
        },
        {
          name: "improvement",
          type: "text",
        },
      ],
    },
    {
      name: "keyDecisions",
      type: "array",
      admin: {
        description: "Key technical decisions",
      },
      fields: [
        {
          name: "decision",
          type: "text",
          required: true,
        },
        {
          name: "reason",
          type: "textarea",
        },
      ],
    },
    {
      name: "challenges",
      type: "array",
      admin: {
        description: "Challenges faced and solutions",
      },
      fields: [
        {
          name: "challenge",
          type: "text",
          required: true,
        },
        {
          name: "solution",
          type: "textarea",
        },
      ],
    },
    {
      name: "compliance",
      type: "array",
      admin: {
        description: "Compliance standards (e.g., GDPR, SOC 2)",
      },
      fields: [
        {
          name: "standard",
          type: "text",
          required: true,
        },
      ],
    },
    {
      name: "architecture",
      type: "group",
      admin: {
        description: "System architecture description",
      },
      fields: [
        {
          name: "description",
          type: "textarea",
        },
      ],
    },
  ],
  hooks: {
    afterChange: [revalidateProject, syncToVectorDB],
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
