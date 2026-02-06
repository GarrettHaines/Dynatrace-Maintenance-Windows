import React, { useState, useMemo, useEffect } from 'react';
import { Divider, Flex } from '@dynatrace/strato-components/layouts';
import { ProgressCircle } from '@dynatrace/strato-components/content';
import { Button } from '@dynatrace/strato-components/buttons';
import { ExternalLink, Paragraph, Text } from '@dynatrace/strato-components/typography';
import { Checkbox, TextInput, Switch, Select, Radio, RadioGroup, Label, DateTimePicker, FormField, TextArea } from '@dynatrace/strato-components-preview/forms';
import { Modal } from '@dynatrace/strato-components-preview/overlays';
import { DataTable } from '@dynatrace/strato-components-preview/tables';
import type { DataTableColumnDef } from '@dynatrace/strato-components-preview/tables';
import { CheckmarkIcon, DeleteIcon, EditIcon, InformationIcon, PlusIcon, SaveIcon, XmarkIcon } from '@dynatrace/strato-icons';
import { settingsObjectsClient, monitoredEntitiesClient } from '@dynatrace-sdk/client-classic-environment-v2';
import { getCurrentUserDetails } from '@dynatrace-sdk/app-environment';
import '../../assets/index.css';


// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface RecurrenceDetails {
  startTime: string;
  endTime: string;
  timeZone: string;
  recurrenceRange?: {
    scheduleStartDate: string;
    scheduleEndDate?: string;
  };
}

interface ApiFilter {
  entityType?: string;
  entityId?: string;
  entityTags?: string[];
  managementZones?: string[];
}

interface MaintenanceWindowRaw {
  objectId: string;
  scope?: string;
  schemaVersion?: string;
  created?: number;
  createdBy?: string;
  modified?: number;
  modifiedBy?: string;
  author?: string;
  updateToken?: string;
  summary?: string;
  value: {
    enabled: boolean;
    generalProperties: {
      name: string;
      description?: string;
      suppression: string;
      maintenanceType: string;
      disableSyntheticMonitorExecution?: boolean;
    };
    schedule: {
      scheduleType: string;
      onceRecurrence?: RecurrenceDetails;
      dailyRecurrence?: RecurrenceDetails;
      weeklyRecurrence?: RecurrenceDetails & { selectedWeekDays?: string[] };
      monthlyRecurrence?: RecurrenceDetails & { dayOfMonth?: number };
    };
    filters?: ApiFilter[];
  };
}

interface MaintenanceWindow {
  objectId: string;
  name: string;
  description: string;
  author: string;
  enabled: boolean;
  suppression: string;
  scheduleType: string;
  startTime: string;
  endTime: string;
  utcOffset: string;
  city: string;
  rawData: MaintenanceWindowRaw;
}

interface ManagementZone {
  id: string;
  name: string;
}

interface EntityReference {
  entityId: string;
  entityType: string;
  displayName: string;
}

interface UnderlyingOptions {
  includeProcesses: boolean;
  includeServices: boolean;
  includeHosts: boolean;
  includeProcessGroups: boolean;
}

interface EntityFilter {
  id: string;
  managementZones: ManagementZone[];
  tags: { key: string; value?: string }[];
  entities: EntityReference[];
  underlyingOptions: UnderlyingOptions;
}

interface EntityTypeOption {
  value: string;
  label: string;
}

interface TimezoneEntry {
  id: string;
  offset: string;
  city: string;
  aliases?: string[];
  hidden?: boolean;
}

interface AutoTagRule {
  type: string;
  enabled: boolean;
  entitySelector: string;
  valueFormat: string;
  valueNormalization: string;
}


// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const PAGE_SIZE = 500;

const SUPPRESSION_OPTIONS = [
  { value: 'DETECT_PROBLEMS_AND_ALERT', label: 'Detect problems and alert' },
  { value: 'DETECT_PROBLEMS_DONT_ALERT', label: "Detect problems but don't alert" },
  { value: 'DONT_DETECT_PROBLEMS', label: "Don't detect problems" },
];

const DEFAULT_ENTITY_TYPES: EntityTypeOption[] = [
  { value: 'APPLICATION', label: 'Application' },
  { value: 'APPLICATION_METHOD', label: 'Application Method' },
  { value: 'APPLICATION_METHOD_GROUP', label: 'Application Method Group' },
  { value: 'AUTO_SCALING_GROUP', label: 'Auto Scaling Group' },
  { value: 'AUXILIARY_SYNTHETIC_TEST', label: 'Auxiliary Synthetic Test' },
  { value: 'AWS_APPLICATION_LOAD_BALANCER', label: 'AWS Application Load Balancer' },
  { value: 'AWS_AVAILABILITY_ZONE', label: 'AWS Availability Zone' },
  { value: 'AWS_CREDENTIALS', label: 'AWS Credentials' },
  { value: 'AWS_LAMBDA_FUNCTION', label: 'AWS Lambda Function' },
  { value: 'AWS_NETWORK_LOAD_BALANCER', label: 'AWS Network Load Balancer' },
  { value: 'AZURE_API_MANAGEMENT_SERVICE', label: 'Azure API Management Service' },
  { value: 'AZURE_APPLICATION_GATEWAY', label: 'Azure Application Gateway' },
  { value: 'AZURE_COSMOS_DB', label: 'Azure Cosmos DB' },
  { value: 'AZURE_CREDENTIALS', label: 'Azure Credentials' },
  { value: 'AZURE_EVENT_HUB', label: 'Azure Event Hub' },
  { value: 'AZURE_EVENT_HUB_NAMESPACE', label: 'Azure Event Hub Namespace' },
  { value: 'AZURE_FUNCTION_APP', label: 'Azure Function App' },
  { value: 'AZURE_IOT_HUB', label: 'Azure IoT Hub' },
  { value: 'AZURE_LOAD_BALANCER', label: 'Azure Load Balancer' },
  { value: 'AZURE_MGMT_GROUP', label: 'Azure Management Group' },
  { value: 'AZURE_REDIS_CACHE', label: 'Azure Redis Cache' },
  { value: 'AZURE_REGION', label: 'Azure Region' },
  { value: 'AZURE_SERVICE_BUS', label: 'Azure Service Bus' },
  { value: 'AZURE_SQL_DATABASE', label: 'Azure SQL Database' },
  { value: 'AZURE_SQL_ELASTIC_POOL', label: 'Azure SQL Elastic Pool' },
  { value: 'AZURE_SQL_SERVER', label: 'Azure SQL Server' },
  { value: 'AZURE_STORAGE_ACCOUNT', label: 'Azure Storage Account' },
  { value: 'AZURE_SUBSCRIPTION', label: 'Azure Subscription' },
  { value: 'AZURE_TENANT', label: 'Azure Tenant' },
  { value: 'AZURE_VM', label: 'Azure VM' },
  { value: 'AZURE_VM_SCALE_SET', label: 'Azure VM Scale Set' },
  { value: 'AZURE_WEB_APP', label: 'Azure Web App' },
  { value: 'BROWSER_MONITOR', label: 'Browser Monitor' },
  { value: 'CINDER_VOLUME', label: 'Cinder Volume' },
  { value: 'CLOUD_APPLICATION', label: 'Cloud Application' },
  { value: 'CLOUD_APPLICATION_INSTANCE', label: 'Cloud Application Instance' },
  { value: 'CLOUD_APPLICATION_NAMESPACE', label: 'Cloud Application Namespace' },
  { value: 'CONTAINER_GROUP', label: 'Container Group' },
  { value: 'CONTAINER_GROUP_INSTANCE', label: 'Container Group Instance' },
  { value: 'CUSTOM_APPLICATION', label: 'Custom Application' },
  { value: 'CUSTOM_DEVICE', label: 'Custom Device' },
  { value: 'CUSTOM_DEVICE_GROUP', label: 'Custom Device Group' },
  { value: 'DCRUM_APPLICATION', label: 'DC RUM Application' },
  { value: 'DCRUM_SERVICE', label: 'DC RUM Service' },
  { value: 'DCRUM_SERVICE_INSTANCE', label: 'DC RUM Service Instance' },
  { value: 'DEVICE_APPLICATION_METHOD', label: 'Device Application Method' },
  { value: 'DISK', label: 'Disk' },
  { value: 'DOCKER_CONTAINER_GROUP', label: 'Docker Container Group' },
  { value: 'DOCKER_CONTAINER_GROUP_INSTANCE', label: 'Docker Container Group Instance' },
  { value: 'DYNAMO_DB_TABLE', label: 'DynamoDB Table' },
  { value: 'EBS_VOLUME', label: 'EBS Volume' },
  { value: 'EC2_INSTANCE', label: 'EC2 Instance' },
  { value: 'ELASTIC_LOAD_BALANCER', label: 'Elastic Load Balancer' },
  { value: 'ENVIRONMENT', label: 'Environment' },
  { value: 'ESXI_HOST', label: 'ESXi Host' },
  { value: 'EXTERNAL_SYNTHETIC_TEST_STEP', label: 'External Synthetic Test Step' },
  { value: 'GCP_ZONE', label: 'GCP Zone' },
  { value: 'GEOLOCATION', label: 'Geolocation' },
  { value: 'GEOLOC_SITE', label: 'Geolocation Site' },
  { value: 'GOOGLE_COMPUTE_ENGINE', label: 'Google Compute Engine' },
  { value: 'HOST', label: 'Host' },
  { value: 'HOST_GROUP', label: 'Host Group' },
  { value: 'HTTP_CHECK', label: 'HTTP Check' },
  { value: 'HTTP_CHECK_STEP', label: 'HTTP Check Step' },
  { value: 'HYPERVISOR', label: 'Hypervisor' },
  { value: 'KUBERNETES_CLUSTER', label: 'Kubernetes Cluster' },
  { value: 'KUBERNETES_NODE', label: 'Kubernetes Node' },
  { value: 'KUBERNETES_SERVICE', label: 'Kubernetes Service' },
  { value: 'MOBILE_APPLICATION', label: 'Mobile Application' },
  { value: 'NETWORK_INTERFACE', label: 'Network Interface' },
  { value: 'NEUTRON_SUBNET', label: 'Neutron Subnet' },
  { value: 'OPENSTACK_PROJECT', label: 'OpenStack Project' },
  { value: 'OPENSTACK_REGION', label: 'OpenStack Region' },
  { value: 'OPENSTACK_VM', label: 'OpenStack VM' },
  { value: 'OS', label: 'Operating System' },
  { value: 'PROCESS_GROUP', label: 'Process Group' },
  { value: 'PROCESS_GROUP_INSTANCE', label: 'Process Group Instance' },
  { value: 'QUEUE', label: 'Queue' },
  { value: 'QUEUE_INSTANCE', label: 'Queue Instance' },
  { value: 'RELATIONAL_DATABASE_SERVICE', label: 'Relational Database Service' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'SERVICE_INSTANCE', label: 'Service Instance' },
  { value: 'SERVICE_METHOD', label: 'Service Method' },
  { value: 'SERVICE_METHOD_GROUP', label: 'Service Method Group' },
  { value: 'SWIFT_CONTAINER', label: 'Swift Container' },
  { value: 'SYNTHETIC_LOCATION', label: 'Synthetic Location' },
  { value: 'SYNTHETIC_TEST', label: 'Synthetic Test' },
  { value: 'SYNTHETIC_TEST_STEP', label: 'Synthetic Test Step' },
  { value: 'VIRTUALMACHINE', label: 'Virtual Machine' },
  { value: 'VMWARE_DATACENTER', label: 'VMware Datacenter' },
].sort((a, b) => a.label.localeCompare(b.label));

const TIMEZONES: TimezoneEntry[] = [
  { id: 'Pacific/Honolulu', offset: '−10:00', city: 'Honolulu', aliases: ['US/Hawaii'] },
  { id: 'America/Anchorage', offset: '−09:00/08:00', city: 'Anchorage', aliases: ['US/Alaska'] },
  { id: 'America/Los_Angeles', offset: '−08:00/07:00', city: 'Los Angeles', aliases: ['US/Pacific', 'PST8PDT', 'America/Vancouver', 'Canada/Pacific'] },
  { id: 'America/Phoenix', offset: '−07:00', city: 'Phoenix', aliases: ['US/Arizona'] },
  { id: 'America/Denver', offset: '−07:00/06:00', city: 'Denver', aliases: ['US/Mountain', 'MST7MDT', 'Canada/Mountain'] },
  { id: 'America/Mexico_City', offset: '−06:00', city: 'Mexico City' },
  { id: 'America/Chicago', offset: '−06:00/05:00', city: 'Chicago', aliases: ['US/Central', 'CST6CDT', 'Canada/Central'] },
  { id: 'America/Bogota', offset: '−05:00', city: 'Bogotá' },
  { id: 'America/Lima', offset: '−05:00', city: 'Lima', hidden: true },
  { id: 'America/New_York', offset: '−05:00/04:00', city: 'New York', aliases: ['US/Eastern', 'EST5EDT', 'America/Toronto', 'Canada/Eastern'] },
  { id: 'America/Caracas', offset: '−04:00', city: 'Caracas' },
  { id: 'America/Halifax', offset: '−04:00/03:00', city: 'Halifax', aliases: ['AST4ADT', 'Canada/Atlantic'], hidden: true },
  { id: 'America/Santiago', offset: '−04:00/03:00', city: 'Santiago' },
  { id: 'America/Sao_Paulo', offset: '−03:00', city: 'São Paulo' },
  { id: 'America/Buenos_Aires', offset: '−03:00', city: 'Buenos Aires', hidden: true },
  { id: 'UTC', offset: '+00:00', city: 'Accra', aliases: ['Etc/UTC', 'Etc/GMT'] },
  { id: 'Europe/London', offset: '+00:00/01:00', city: 'London', aliases: ['Europe/Dublin', 'Europe/Lisbon'] },
  { id: 'Africa/Lagos', offset: '+01:00', city: 'Lagos' },
  { id: 'Europe/Paris', offset: '+01:00/02:00', city: 'Paris', aliases: ['Europe/Amsterdam', 'Europe/Rome', 'Europe/Madrid', 'Europe/Stockholm', 'Europe/Warsaw'] },
  { id: 'Europe/Berlin', offset: '+01:00/02:00', city: 'Berlin', hidden: true },
  { id: 'Africa/Johannesburg', offset: '+02:00', city: 'Johannesburg', hidden: true },
  { id: 'Africa/Cairo', offset: '+02:00', city: 'Cairo' },
  { id: 'Europe/Athens', offset: '+02:00/03:00', city: 'Athens' },
  { id: 'Europe/Helsinki', offset: '+02:00/03:00', city: 'Helsinki', aliases: ['Europe/Bucharest'], hidden: true },
  { id: 'Asia/Jerusalem', offset: '+02:00/03:00', city: 'Jerusalem', hidden: true },
  { id: 'Europe/Moscow', offset: '+03:00', city: 'Moscow', hidden: true },
  { id: 'Europe/Istanbul', offset: '+03:00', city: 'Istanbul' },
  { id: 'Asia/Riyadh', offset: '+03:00', city: 'Riyadh', hidden: true },
  { id: 'Asia/Dubai', offset: '+04:00', city: 'Dubai' },
  { id: 'Asia/Karachi', offset: '+05:00', city: 'Karachi' },
  { id: 'Asia/Kolkata', offset: '+05:30', city: 'Kolkata', aliases: ['Asia/Calcutta', 'Asia/Mumbai', 'Asia/Delhi', 'Asia/Chennai', 'Asia/Bangalore'] },
  { id: 'Asia/Bangkok', offset: '+07:00', city: 'Bangkok', aliases: ['Asia/Ho_Chi_Minh'], hidden: true },
  { id: 'Asia/Jakarta', offset: '+07:00', city: 'Jakarta' },
  { id: 'Asia/Singapore', offset: '+08:00', city: 'Singapore', aliases: ['Asia/Kuala_Lumpur'], hidden: true },
  { id: 'Asia/Hong_Kong', offset: '+08:00', city: 'Hong Kong', hidden: true },
  { id: 'Asia/Shanghai', offset: '+08:00', city: 'Shanghai', aliases: ['Asia/Taipei'] },
  { id: 'Asia/Manila', offset: '+08:00', city: 'Manila', hidden: true },
  { id: 'Australia/Perth', offset: '+08:00', city: 'Perth', aliases: ['Australia/West'], hidden: true },
  { id: 'Asia/Seoul', offset: '+09:00', city: 'Seoul', hidden: true },
  { id: 'Asia/Tokyo', offset: '+09:00', city: 'Tokyo' },
  { id: 'Australia/Darwin', offset: '+09:30', city: 'Darwin', aliases: ['Australia/North'] },
  { id: 'Australia/Adelaide', offset: '+09:30/10:30', city: 'Adelaide', aliases: ['Australia/South'] },
  { id: 'Australia/Brisbane', offset: '+10:00', city: 'Brisbane', aliases: ['Australia/Queensland'] },
  { id: 'Australia/Sydney', offset: '+10:00/11:00', city: 'Sydney', aliases: ['Australia/Melbourne', 'Australia/Victoria', 'Australia/NSW'] },
  { id: 'Pacific/Auckland', offset: '+12:00/13:00', city: 'Auckland' },
];

const timezoneLookup: Record<string, { offset: string; city: string; canonicalId: string }> = {};
TIMEZONES.forEach(tz => {
  timezoneLookup[tz.id] = { offset: tz.offset, city: tz.city, canonicalId: tz.id };
  tz.aliases?.forEach(alias => {
    timezoneLookup[alias] = { offset: tz.offset, city: tz.city, canonicalId: tz.id };
  });
});

const TIMEZONE_OPTIONS = TIMEZONES.filter(tz => !tz.hidden);

const QUICK_ENTITY_TYPES = [
  { value: 'HOST', label: 'Host' },
  { value: 'HOST_GROUP', label: 'Host Group' },
  { value: 'PROCESS_GROUP', label: 'Process Group' },
  { value: 'SERVICE', label: 'Service' },
  { value: 'APPLICATION', label: 'Application' },
  { value: 'OTHER', label: 'Other' },
];

const ENTITY_TYPES_WITH_UNDERLYING = ['HOST', 'PROCESS_GROUP', 'SERVICE'];
const MAINTENANCE_TAG_VALUE = 'delete after expiration';


// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

function detectUserTimezone(): string {
  try {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timezoneLookup[browserTz]?.canonicalId ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

function getTimezoneOffset(id: string): string {
  return timezoneLookup[id]?.offset ?? '?';
}

function getTimezoneCity(id: string): string {
  return timezoneLookup[id]?.city ?? '?';
}

function getEntityTypeLabel(value: string, types: EntityTypeOption[] = DEFAULT_ENTITY_TYPES): string {
  return types.find(t => t.value === value)?.label ?? value;
}

function formatDateTime(iso: string): string {
  if (!iso) return 'N/A';
  const match = iso.match(/(\d{4}-\d{2}-\d{2})T?(\d{2}:\d{2})/);
  return match ? `${match[1]} ${match[2]}` : iso;
}

function toApiDateTime(dateString: string): string {
  if (!dateString) return '';
  const match = dateString.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
  if (match) return match[1];
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatTimestamp(ts?: number): string {
  return ts ? new Date(ts).toLocaleString() : '—';
}

function formatWeekDays(days?: string[]): string {
  if (!days?.length) return 'None';
  const order = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
  const names: Record<string, string> = { MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat', SUNDAY: 'Sun' };
  return days.sort((a, b) => order.indexOf(a) - order.indexOf(b)).map(d => names[d] || d).join(', ');
}

function generateFilterId(): string {
  return `filter-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function parseDescription(description: string): { text: string; author: string } {
  if (!description) return { text: '', author: 'Unknown' };
  const match = description.match(/\[([^\]]+@[^\]]+)\]\s*$/);
  if (match) return { text: description.replace(/\s*\[[^\]]+@[^\]]+\]\s*$/, '').trim(), author: match[1] };
  return { text: description, author: 'Unknown' };
}

function getSuppressionLabel(value: string): string {
  const labels: Record<string, string> = { 'DONT_DETECT_PROBLEMS': 'Problem detection', 'DETECT_PROBLEMS_DONT_ALERT': 'Alerts only', 'DETECT_PROBLEMS_AND_ALERT': 'None' };
  return labels[value] ?? value;
}

function getSuppressionDescription(value: string): string {
  const descriptions: Record<string, string> = { 'DONT_DETECT_PROBLEMS': "Don't detect problems", 'DETECT_PROBLEMS_DONT_ALERT': "Detect problems but don't alert", 'DETECT_PROBLEMS_AND_ALERT': 'Detect problems and alert' };
  return descriptions[value] ?? value;
}

function getScheduleTypeLabel(value: string): string {
  const labels: Record<string, string> = { 'ONCE': 'Once', 'DAILY': 'Daily', 'WEEKLY': 'Weekly', 'MONTHLY': 'Monthly' };
  return labels[value] ?? value;
}

function getMaintenanceTypeLabel(value: string): string {
  const labels: Record<string, string> = { 'PLANNED': 'Planned', 'UNPLANNED': 'Unplanned' };
  return labels[value] ?? value;
}

function getDefaultUnderlyingOptions(): UnderlyingOptions {
  return { includeProcesses: false, includeServices: false, includeHosts: false, includeProcessGroups: false };
}

function sanitizeTagName(name: string): string {
  return name.replace(/[^\w\s\-—]/g, '').trim();
}

function generateMaintenanceTagKey(windowName: string): string {
  return `Maintenance — ${sanitizeTagName(windowName)}`;
}


// -----------------------------------------------------------------------------
// Auto-tagging utilities
// -----------------------------------------------------------------------------

function buildEntitySelectorsForUnderlying(entity: EntityReference, options: UnderlyingOptions): { entityType: string; selector: string }[] {
  const selectors: { entityType: string; selector: string }[] = [];
  const entityId = entity.entityId;

  // Always include the base entity
  selectors.push({ entityType: entity.entityType, selector: `type(${entity.entityType}),entityId("${entityId}")` });

  if (entity.entityType === 'HOST') {
    if (options.includeProcesses) {
      selectors.push({ entityType: 'PROCESS_GROUP_INSTANCE', selector: `type(PROCESS_GROUP_INSTANCE),fromRelationships.isProcessOf(entityId("${entityId}"))` });
    }
    if (options.includeServices) {
      selectors.push({
        entityType: 'SERVICE_INSTANCE',
        selector: `type("SERVICE"),fromRelationships.runsOnHost(entityId("${entityId}"))`
      });
    }
  } else if (entity.entityType === 'PROCESS_GROUP') {
    if (options.includeHosts) {
      selectors.push({ entityType: 'HOST', selector: `type(HOST),toRelationships.runsOn(entityId("${entityId}"))` });
    }
    if (options.includeServices) {
      selectors.push({ entityType: 'SERVICE', selector: `type(SERVICE),fromRelationships.runsOn(entityId("${entityId}"))` });
    }
  } else if (entity.entityType === 'SERVICE') {
    if (options.includeHosts) {
      selectors.push({ entityType: 'HOST', selector: `type(HOST),toRelationships.runsOnHost(entityId("${entityId}"))` });
    }
    if (options.includeProcessGroups) {
      selectors.push({ entityType: 'PROCESS_GROUP', selector: `type(PROCESS_GROUP),toRelationships.runsOn(entityId("${entityId}"))` });
    }
  }

  return selectors;
}

function hasUnderlyingOptionsSelected(options: UnderlyingOptions): boolean {
  return options.includeProcesses || options.includeServices || options.includeHosts || options.includeProcessGroups;
}


// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

function transformApiItems(items: any[]): MaintenanceWindow[] {
  return items.map(item => {
    const props = item.value?.generalProperties;
    const schedule = item.value?.schedule;
    const enabled = item.value?.enabled ?? false;
    const { text: description, author } = parseDescription(props?.description ?? '');
    const recurrence = schedule?.onceRecurrence ?? schedule?.dailyRecurrence ?? schedule?.weeklyRecurrence ?? schedule?.monthlyRecurrence;
    const tzId = recurrence?.timeZone ?? '';
    const name = props?.name ?? 'Unnamed';
    return {
      objectId: item.objectId,
      name: enabled ? name : `[Disabled] ${name}`,
      description, author, enabled,
      suppression: props?.suppression ?? '',
      scheduleType: schedule?.scheduleType ?? '',
      startTime: formatDateTime(recurrence?.startTime ?? ''),
      endTime: formatDateTime(recurrence?.endTime ?? ''),
      utcOffset: getTimezoneOffset(tzId),
      city: getTimezoneCity(tzId),
      rawData: item as MaintenanceWindowRaw,
    };
  });
}

async function fetchMaintenanceWindows(): Promise<MaintenanceWindow[]> {
  const results: MaintenanceWindow[] = [];
  async function fetchPage(pageKey?: string): Promise<void> {
    const response = await settingsObjectsClient.getSettingsObjects({
      schemaIds: 'builtin:alerting.maintenance-window',
      pageSize: 500,
      fields: 'objectId,value,created,modified,createdBy,modifiedBy,author,schemaVersion',
      ...(pageKey && { nextPageKey: pageKey }),
    });
    results.push(...transformApiItems(response.items ?? []));
    if (response.nextPageKey) await fetchPage(response.nextPageKey);
  }
  try { await fetchPage(); } catch (err) { console.error('Failed to fetch maintenance windows:', err); }
  return results;
}

async function fetchManagementZones(): Promise<ManagementZone[]> {
  try {
    const response = await settingsObjectsClient.getSettingsObjects({ schemaIds: 'builtin:management-zones', pageSize: 500 });
    return (response.items ?? []).map((item: any) => ({ id: item.objectId, name: item.value?.name ?? 'Unknown' })).sort((a, b) => a.name.localeCompare(b.name));
  } catch (err) { console.error('Failed to fetch management zones:', err); return []; }
}

async function fetchEntityTypes(): Promise<EntityTypeOption[]> {
  try {
    const response = await monitoredEntitiesClient.getEntityTypes({ pageSize: 500 });
    return (response.types ?? []).map((t: any) => ({ value: t.type, label: t.displayName || t.type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) })).sort((a, b) => a.label.localeCompare(b.label));
  } catch (err) { console.error('Failed to fetch entity types:', err); return DEFAULT_ENTITY_TYPES; }
}

async function searchEntities(entityType: string, term: string): Promise<EntityReference[]> {
  if (!entityType || !term || term.length < 1) return [];
  try {
    const response = await monitoredEntitiesClient.getEntities({ entitySelector: `type("${entityType}"),entityName.contains("${term}")`, from: 'now-30d', pageSize: 20 });
    return (response.entities ?? []).map((e: any) => ({ entityId: e.entityId, entityType, displayName: e.displayName ?? e.entityId }));
  } catch (err) { console.error('Failed to search entities:', err); return []; }
}

async function createAutoTagWithRules(tagName: string, tagValue: string, rules: AutoTagRule[]): Promise<string | null> {
  try {
    const payload = {
      schemaId: 'builtin:tags.auto-tagging',
      scope: 'environment',
      value: {
        name: tagName,
        description: `Auto-generated tag for maintenance window. Value: ${tagValue}. This tag can be safely deleted after the maintenance window expires.`,
        rules: rules.map(rule => ({ type: rule.type, enabled: rule.enabled, valueFormat: rule.valueFormat, valueNormalization: rule.valueNormalization, entitySelector: rule.entitySelector })),
      },
    };
    const response = await settingsObjectsClient.postSettingsObjects({ body: [payload] });
    if (response && response.length > 0 && response[0].objectId) return response[0].objectId;
    return null;
  } catch (err) { console.error('Failed to create auto-tag:', err); throw err; }
}


// -----------------------------------------------------------------------------
// Details Modal
// -----------------------------------------------------------------------------

interface DetailsModalProps {
  window: MaintenanceWindow | null;
  managementZones: ManagementZone[];
  entityTypes: EntityTypeOption[];
  onClose: () => void;
}

const DetailsModal: React.FC<DetailsModalProps> = ({ window: mw, managementZones, entityTypes, onClose }) => {
  if (!mw) return null;
  const raw = mw.rawData;
  const props = raw.value?.generalProperties;
  const schedule = raw.value?.schedule;
  const filters = raw.value?.filters ?? [];
  const recurrence = schedule?.onceRecurrence ?? schedule?.dailyRecurrence ?? schedule?.weeklyRecurrence ?? schedule?.monthlyRecurrence;
  const tzId = recurrence?.timeZone ?? 'UTC';
  const recurrenceRange = recurrence?.recurrenceRange;

  const mzLookup = useMemo(() => {
    const map: Record<string, string> = {};
    managementZones.forEach(mz => { map[mz.id] = mz.name; });
    return map;
  }, [managementZones]);

  const displayAuthor = (() => {
    const rawAuthor = raw.author ?? '';
    if (rawAuthor.startsWith('Dynatrace support user')) return (mw.author !== 'Unknown') ? mw.author : rawAuthor;
    return rawAuthor || mw.author || 'Unknown';
  })();

  const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <Flex gap={8} className="details-field"><Text className="details-field-label">{label}</Text><Text>{value || '—'}</Text></Flex>
  );
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="details-section"><Text className="details-section-title">{title}</Text>{children}</div>
  );
  const FilterSection = ({ label, items }: { label: string; items: React.ReactNode[] }) => (
    <div className="details-filter-section"><Text className="details-filter-label">{label}</Text><Flex flexWrap="wrap" gap={6}>{items}</Flex></div>
  );
  const Chip = ({ text }: { text: string }) => (<span className="chip"><span className="chip-text">{text}</span></span>);

  return (
    <Modal show onDismiss={onClose} title="Maintenance window details" size="medium">
      <Flex flexDirection="column" className="details-modal-content">
        <Section title="General">
          <Field label="Name" value={props?.name} />
          <Field label="Description" value={mw.description || '—'} />
          <Field label="Maintenance type" value={getMaintenanceTypeLabel(props?.maintenanceType ?? '')} />
          <Field label="Suppression" value={getSuppressionDescription(props?.suppression ?? '')} />
          <Field label="Disable synthetics" value={props?.disableSyntheticMonitorExecution ? 'Yes' : 'No'} />
          <Field label="Author" value={displayAuthor} />
          <Field label="Created" value={formatTimestamp(raw.created)} />
          <Field label="Last modified" value={formatTimestamp(raw.modified)} />
          <Field label="Status" value={mw.enabled ? 'Enabled' : 'Disabled'} />
        </Section>
        <Divider />
        <Section title="Schedule">
          <Field label="Recurrence" value={getScheduleTypeLabel(schedule?.scheduleType ?? '')} />
          <Field label="Start time" value={formatDateTime(recurrence?.startTime ?? '')} />
          <Field label="End time" value={formatDateTime(recurrence?.endTime ?? '')} />
          <Field label="Timezone" value={`UTC ${getTimezoneOffset(tzId)}`} />
          <Field label="Region" value={getTimezoneCity(tzId)} />
          {schedule?.scheduleType === 'WEEKLY' && schedule.weeklyRecurrence?.selectedWeekDays && (<Field label="Repeats on" value={formatWeekDays(schedule.weeklyRecurrence.selectedWeekDays)} />)}
          {schedule?.scheduleType === 'MONTHLY' && schedule.monthlyRecurrence?.dayOfMonth && (<Field label="Day of month" value={schedule.monthlyRecurrence.dayOfMonth.toString()} />)}
          {recurrenceRange && (<><Field label="Schedule starts" value={recurrenceRange.scheduleStartDate || '—'} /><Field label="Schedule ends" value={recurrenceRange.scheduleEndDate || 'Never'} /></>)}
        </Section>
        <Divider />
        <Section title="Filtered entity groups">
          {filters.length === 0 ? (<Text className="text-secondary">No filters defined. Applies to entire environment.</Text>) : (
            <Flex flexDirection="column" gap={12}>
              {filters.map((filter, idx) => (
                <div key={idx} className="details-filter-card">
                  {(filter.managementZones?.length ?? 0) > 0 && (<span className="details-filter-section"><FilterSection label="Management zones" items={filter.managementZones!.map((mzId, i) => <Chip key={i} text={mzLookup[mzId] || mzId} />)} /></span>)}
                  {(filter.entityTags?.length ?? 0) > 0 && (<span className="details-filter-section"><FilterSection label="Tags" items={filter.entityTags!.map((tag, i) => <Chip key={i} text={tag} />)} /></span>)}
                  {filter.entityId && (<span className="details-filter-section"><FilterSection label="Entity" items={[<Chip key="e" text={filter.entityId} />]} /></span>)}
                  {filter.entityType && !filter.entityId && (<span className="details-filter-section"><FilterSection label="Entity type" items={[<Chip key="et" text={getEntityTypeLabel(filter.entityType, entityTypes)} />]} /></span>)}
                </div>
              ))}
            </Flex>
          )}
        </Section>
        <Divider />
        <Section title="API details">
          {raw.createdBy && <Field label="Author UUID" value={<span className="text-mono">{raw.createdBy}</span>} />}
          {raw.modifiedBy && <Field label="Last modifier UUID" value={<span className="text-mono">{raw.modifiedBy}</span>} />}
          <Field label="Timezone ID" value={<span className="text-mono">{tzId}</span>} />
          <Field label="Schema ID" value={<span className="text-mono">builtin:alerting.maintenance-window</span>} />
          {raw.schemaVersion && <Field label="Schema version" value={<span className="text-mono">{raw.schemaVersion}</span>} />}
          <Field label="Object ID" value={<span className="text-mono">{mw.objectId}</span>} />
        </Section>
      </Flex>
    </Modal>
  );
};


// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export const MaintenanceWindows = () => {
  const userDetails = getCurrentUserDetails();

  const [windows, setWindows] = useState<MaintenanceWindow[]>([]);
  const [managementZones, setManagementZones] = useState<ManagementZone[]>([]);
  const [entityTypes, setEntityTypes] = useState<EntityTypeOption[]>(DEFAULT_ENTITY_TYPES);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMZs, setIsLoadingMZs] = useState(true);
  const [isLoadingEntityTypes, setIsLoadingEntityTypes] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSearchingEntities, setIsSearchingEntities] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDisabled, setShowDisabled] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDateTime, setStartDateTime] = useState<string | null>(null);
  const [endDateTime, setEndDateTime] = useState<string | null>(null);
  const [timezone, setTimezone] = useState(detectUserTimezone);
  const [suppression, setSuppression] = useState('DETECT_PROBLEMS_AND_ALERT');
  const [disableSynthetics, setDisableSynthetics] = useState('no');
  const [filters, setFilters] = useState<EntityFilter[]>([]);
  const [editingMZFilterId, setEditingMZFilterId] = useState<string | null>(null);
  const [editingTagFilterId, setEditingTagFilterId] = useState<string | null>(null);
  const [editingEntityFilterId, setEditingEntityFilterId] = useState<string | null>(null);
  const [pendingMZSelection, setPendingMZSelection] = useState('');
  const [pendingTagKey, setPendingTagKey] = useState('');
  const [pendingTagValue, setPendingTagValue] = useState('');
  const [pendingEntityType, setPendingEntityType] = useState('');
  const [entityTypeSearchTerm, setEntityTypeSearchTerm] = useState('');
  const [pendingEntitySearch, setPendingEntitySearch] = useState('');
  const [entitySearchResults, setEntitySearchResults] = useState<EntityReference[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<EntityReference | null>(null);
  const [entityQuickSelect, setEntityQuickSelect] = useState<string | null>(null);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [detailsWindow, setDetailsWindow] = useState<MaintenanceWindow | null>(null);

  // Bulk hosts modal state
  const [isBulkHostsModalOpen, setIsBulkHostsModalOpen] = useState(false);
  const [bulkHostsInput, setBulkHostsInput] = useState('');
  const [bulkIncludeProcesses, setBulkIncludeProcesses] = useState(false);
  const [bulkIncludeServices, setBulkIncludeServices] = useState(false);
  const [bulkMZs, setBulkMZs] = useState<ManagementZone[]>([]);
  const [bulkTags, setBulkTags] = useState<{ key: string; value?: string }[]>([]);
  const [bulkPendingMZ, setBulkPendingMZ] = useState('');
  const [bulkPendingTagKey, setBulkPendingTagKey] = useState('');
  const [bulkPendingTagValue, setBulkPendingTagValue] = useState('');
  const [isResolvingHosts, setIsResolvingHosts] = useState(false);
  const [bulkHostsError, setBulkHostsError] = useState('');

  useEffect(() => { (async () => { setIsLoading(true); setWindows(await fetchMaintenanceWindows()); setIsLoading(false); })(); }, []);
  useEffect(() => { (async () => { setIsLoadingMZs(true); setManagementZones(await fetchManagementZones()); setIsLoadingMZs(false); })(); }, []);
  useEffect(() => { (async () => { setIsLoadingEntityTypes(true); setEntityTypes(await fetchEntityTypes()); setIsLoadingEntityTypes(false); })(); }, []);

  useEffect(() => {
    if (!pendingEntityType || !pendingEntitySearch || pendingEntitySearch.length < 1) { setEntitySearchResults([]); return; }
    setIsSearchingEntities(true);
    const timer = setTimeout(async () => {
      try { setEntitySearchResults(await searchEntities(pendingEntityType, pendingEntitySearch)); }
      catch { setEntitySearchResults([]); }
      finally { setIsSearchingEntities(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [pendingEntityType, pendingEntitySearch]);

  useEffect(() => { setCurrentPage(0); }, [searchTerm, showDisabled]);

  const filteredWindows = useMemo(() => {
    let result = windows;
    if (!showDisabled) result = result.filter(w => w.enabled);
    if (searchTerm) { const term = searchTerm.toLowerCase(); result = result.filter(w => w.name.toLowerCase().includes(term)); }
    return result;
  }, [windows, showDisabled, searchTerm]);

  const totalPages = Math.ceil(filteredWindows.length / PAGE_SIZE);
  const pageData = useMemo(() => { const start = currentPage * PAGE_SIZE; return filteredWindows.slice(start, start + PAGE_SIZE); }, [filteredWindows, currentPage]);
  const filteredEntityTypes = useMemo(() => { if (!entityTypeSearchTerm) return entityTypes; const term = entityTypeSearchTerm.toLowerCase(); return entityTypes.filter(et => et.label.toLowerCase().includes(term) || et.value.toLowerCase().includes(term)); }, [entityTypes, entityTypeSearchTerm]);

  const columns: DataTableColumnDef<MaintenanceWindow>[] = useMemo(() => [
    { id: 'name', header: 'Name', accessor: 'name', minWidth: 175, maxWidth: 500, width: '3fr' },
    { id: 'startTime', header: 'Start time', accessor: 'startTime', minWidth: 142, maxWidth: 142 },
    { id: 'endTime', header: 'End time', accessor: 'endTime', minWidth: 142, maxWidth: 142 },
    { id: 'utcOffset', header: 'UTC offset', accessor: 'utcOffset', minWidth: 110, maxWidth: 110 },
    { id: 'city', header: 'Region', accessor: 'city', minWidth: 100 },
    { id: 'suppression', header: 'Suppressing', accessor: row => getSuppressionLabel(row.suppression), minWidth: 140, maxWidth: 140 },
    { id: 'info', header: 'Info', accessor: row => row, minWidth: 51, maxWidth: 51, cell: ({ value }) => (<Flex flex={1} justifyContent="center"><Button variant="default" size="condensed" onClick={e => { e.stopPropagation(); setDetailsWindow(value as MaintenanceWindow); }} aria-label="View details"><InformationIcon /></Button></Flex>) },
  ], []);

  function resetForm() {
    setName(''); setDescription(''); setStartDateTime(null); setEndDateTime(null); setTimezone(detectUserTimezone()); setSuppression('DETECT_PROBLEMS_AND_ALERT'); setDisableSynthetics('no'); setFilters([]);
    setEditingMZFilterId(null); setEditingTagFilterId(null); setEditingEntityFilterId(null); setPendingMZSelection(''); setPendingTagKey(''); setPendingTagValue(''); setPendingEntityType(''); setPendingEntitySearch(''); setEntitySearchResults([]); setSelectedEntity(null); setEntityTypeSearchTerm(''); setEntityQuickSelect(null);
  }

  function openCreateModal() { resetForm(); setIsCreateModalOpen(true); }
  function closeCreateModal() { setIsCreateModalOpen(false); resetForm(); }

  function validateForm(): string | null {
    if (!name.trim()) return 'Name is required.';
    if (!startDateTime) return 'Start time is required.';
    if (!endDateTime) return 'End time is required.';
    if (new Date(endDateTime) <= new Date(startDateTime)) return 'End time must be after start time.';
    if (filters.length === 0) return 'You must add at least one entity filter.<br>Without an entity filter, the maintenance window would apply to the entire environment.';
    if (filters.some(f => f.managementZones.length === 0 && f.tags.length === 0 && f.entities.length === 0)) return 'Each entity filter must contain at least one management zone, tag, or entity.';
    return null;
  }

  function filtersRequireAutoTagging(): boolean {
    return filters.some(f => f.entities.some(entity => ENTITY_TYPES_WITH_UNDERLYING.includes(entity.entityType) && hasUnderlyingOptionsSelected(f.underlyingOptions)));
  }

  function buildAutoTagRules(tagKey: string): AutoTagRule[] {
    const rules: AutoTagRule[] = [];
    filters.forEach(filter => {
      filter.entities.forEach(entity => {
        if (ENTITY_TYPES_WITH_UNDERLYING.includes(entity.entityType) && hasUnderlyingOptionsSelected(filter.underlyingOptions)) {
          const selectors = buildEntitySelectorsForUnderlying(entity, filter.underlyingOptions);
          selectors.forEach(({ selector }) => { rules.push({ type: 'SELECTOR', enabled: true, entitySelector: selector, valueFormat: MAINTENANCE_TAG_VALUE, valueNormalization: 'Leave text as-is' }); });
        }
      });
    });
    return rules;
  }

  function buildPayload(tagKey?: string) {
    const apiFilters: ApiFilter[] = [];
    filters.forEach(f => {
      const baseTags = f.tags.map(t => t.value ? `${t.key}:${t.value}` : t.key);
      const baseMZs = f.managementZones.map(mz => mz.id);
      if (f.entities.length > 0) {
        f.entities.forEach(entity => {
          const needsAutoTag = ENTITY_TYPES_WITH_UNDERLYING.includes(entity.entityType) && hasUnderlyingOptionsSelected(f.underlyingOptions);
          if (needsAutoTag && tagKey) {
            const selectors = buildEntitySelectorsForUnderlying(entity, f.underlyingOptions);
            const uniqueEntityTypes = [...new Set(selectors.map(s => s.entityType))];
            uniqueEntityTypes.forEach(entityType => { apiFilters.push({ entityType, entityId: undefined, entityTags: [...baseTags, `${tagKey}:${MAINTENANCE_TAG_VALUE}`], managementZones: baseMZs }); });
          } else {
            apiFilters.push({ entityType: entity.entityType, entityId: entity.entityId, entityTags: baseTags, managementZones: baseMZs });
          }
        });
      } else {
        apiFilters.push({ entityType: undefined, entityId: undefined, entityTags: baseTags, managementZones: baseMZs });
      }
    });
    return {
      schemaId: 'builtin:alerting.maintenance-window', scope: 'environment',
      value: {
        enabled: true,
        generalProperties: { name: name.trim(), description: description.trim() ? `${description.trim()} [${userDetails.email}]` : `[${userDetails.email}]`, maintenanceType: 'PLANNED', suppression, disableSyntheticMonitorExecution: disableSynthetics === 'yes' },
        schedule: { scheduleType: 'ONCE', onceRecurrence: { startTime: toApiDateTime(startDateTime!), endTime: toApiDateTime(endDateTime!), timeZone: timezone } },
        filters: apiFilters,
      },
    };
  }

  async function saveMaintenanceWindow() {
    const error = validateForm();
    if (error) { setErrorMessage(error); setIsErrorModalOpen(true); return; }
    setIsSaving(true);
    try {
      let tagKey: string | undefined;
      if (filtersRequireAutoTagging()) {
        tagKey = generateMaintenanceTagKey(name.trim());
        const rules = buildAutoTagRules(tagKey);
        if (rules.length > 0) {
          const autoTagId = await createAutoTagWithRules(tagKey, MAINTENANCE_TAG_VALUE, rules);
          if (!autoTagId) throw new Error('Failed to create auto-tagging rule. The maintenance window was not created.');
        }
      }
      await settingsObjectsClient.postSettingsObjects({ body: [buildPayload(tagKey)] });
      setIsCreateModalOpen(false); setIsSuccessModalOpen(true);
      setIsLoading(true); setWindows(await fetchMaintenanceWindows()); setIsLoading(false);
    } catch (err: any) { setErrorMessage(err?.body?.message ?? err?.message ?? 'Failed to create maintenance window.'); setIsErrorModalOpen(true); }
    finally { setIsSaving(false); }
  }

  function addFilter() { setFilters(prev => [...prev, { id: generateFilterId(), managementZones: [], tags: [], entities: [], underlyingOptions: getDefaultUnderlyingOptions() }]); }
  function removeFilter(id: string) { setFilters(prev => prev.filter(f => f.id !== id)); }

  function addMZToFilter(filterId: string) {
    if (!pendingMZSelection) return;
    const zone = managementZones.find(mz => mz.id === pendingMZSelection);
    if (!zone) return;
    setFilters(prev => prev.map(f => { if (f.id !== filterId || f.managementZones.some(mz => mz.id === pendingMZSelection)) return f; return { ...f, managementZones: [...f.managementZones, zone] }; }));
    setPendingMZSelection(''); setEditingMZFilterId(null);
  }

  function removeMZFromFilter(filterId: string, zoneId: string) { setFilters(prev => prev.map(f => { if (f.id !== filterId) return f; return { ...f, managementZones: f.managementZones.filter(mz => mz.id !== zoneId) }; })); }

  function addTagToFilter(filterId: string) {
    if (!pendingTagKey.trim()) return;
    setFilters(prev => prev.map(f => { if (f.id !== filterId) return f; return { ...f, tags: [...f.tags, { key: pendingTagKey.trim(), value: pendingTagValue.trim() || undefined }] }; }));
    setPendingTagKey(''); setPendingTagValue(''); setEditingTagFilterId(null);
  }

  function removeTagFromFilter(filterId: string, tagIndex: number) { setFilters(prev => prev.map(f => { if (f.id !== filterId) return f; const newTags = [...f.tags]; newTags.splice(tagIndex, 1); return { ...f, tags: newTags }; })); }

  function addEntityToFilter(filterId: string) {
    if (!selectedEntity) return;
    setFilters(prev => prev.map(f => { if (f.id !== filterId || f.entities.some(e => e.entityId === selectedEntity.entityId)) return f; return { ...f, entities: [...f.entities, selectedEntity] }; }));
    clearEntitySelection();
  }

  function removeEntityFromFilter(filterId: string, entityId: string) {
    setFilters(prev => prev.map(f => { if (f.id !== filterId) return f; return { ...f, entities: f.entities.filter(e => e.entityId !== entityId), underlyingOptions: f.entities.length <= 1 ? getDefaultUnderlyingOptions() : f.underlyingOptions }; }));
  }

  function updateUnderlyingOption(filterId: string, option: keyof UnderlyingOptions, value: boolean) {
    setFilters(prev => prev.map(f => { if (f.id !== filterId) return f; return { ...f, underlyingOptions: { ...f.underlyingOptions, [option]: value } }; }));
  }

  function clearEntitySelection() { setSelectedEntity(null); setPendingEntityType(''); setPendingEntitySearch(''); setEntitySearchResults([]); setEntityTypeSearchTerm(''); setEditingEntityFilterId(null); setEntityQuickSelect(null); }
  function startEditingMZ(filterId: string) { setEditingMZFilterId(filterId); setEditingTagFilterId(null); setEditingEntityFilterId(null); }
  function startEditingTag(filterId: string) { setEditingTagFilterId(filterId); setEditingMZFilterId(null); setEditingEntityFilterId(null); }
  function startEditingEntity(filterId: string) { setEditingEntityFilterId(filterId); setEditingMZFilterId(null); setEditingTagFilterId(null); setEntityTypeSearchTerm(''); setPendingEntityType(''); setPendingEntitySearch(''); setEntitySearchResults([]); setSelectedEntity(null); setEntityQuickSelect(null); }

  // Bulk hosts modal functions
  function openBulkHostsModal() {
    setBulkHostsInput('');
    setBulkIncludeProcesses(false);
    setBulkIncludeServices(false);
    setBulkMZs([]);
    setBulkTags([]);
    setBulkPendingMZ('');
    setBulkPendingTagKey('');
    setBulkPendingTagValue('');
    setBulkHostsError('');
    setIsBulkHostsModalOpen(true);
  }

  function closeBulkHostsModal() {
    setIsBulkHostsModalOpen(false);
  }

  function addBulkMZ() {
    if (!bulkPendingMZ) return;
    const zone = managementZones.find(mz => mz.id === bulkPendingMZ);
    if (!zone || bulkMZs.some(mz => mz.id === bulkPendingMZ)) return;
    setBulkMZs(prev => [...prev, zone]);
    setBulkPendingMZ('');
  }

  function removeBulkMZ(zoneId: string) {
    setBulkMZs(prev => prev.filter(mz => mz.id !== zoneId));
  }

  function addBulkTag() {
    if (!bulkPendingTagKey.trim()) return;
    setBulkTags(prev => [...prev, { key: bulkPendingTagKey.trim(), value: bulkPendingTagValue.trim() || undefined }]);
    setBulkPendingTagKey('');
    setBulkPendingTagValue('');
  }

  function removeBulkTag(index: number) {
    setBulkTags(prev => { const newTags = [...prev]; newTags.splice(index, 1); return newTags; });
  }

  function parseHostsList(input: string): string[] {
    // Split by commas, newlines, tabs, or multiple spaces
    const hosts = input
      .split(/[,\s]+/)
      .map(h => h.trim())
      .filter(h => h.length > 0);
    // Remove duplicates
    return [...new Set(hosts)];
  }

  async function resolveHostByName(hostName: string): Promise<EntityReference | null> {
    try {
      // First try exact match on entity name
      let response = await monitoredEntitiesClient.getEntities({
        entitySelector: `type("HOST"),entityName.equals("${hostName}")`,
        from: 'now-30d',
        pageSize: 1,
      });
      
      if (response.entities && response.entities.length > 0) {
        const e = response.entities[0];
        return { entityId: e.entityId ?? 'HOST', entityType: 'HOST', displayName: e.displayName ?? e.entityId ?? 'HOST' };
      }

      // Try detected name property match
      response = await monitoredEntitiesClient.getEntities({
        entitySelector: `type("HOST"),detectedName.equals("${hostName}")`,
        from: 'now-30d',
        pageSize: 1,
      });

      if (response.entities && response.entities.length > 0) {
        const e = response.entities[0];
        return { entityId: e.entityId ?? 'HOST', entityType: 'HOST', displayName: e.displayName ?? e.entityId ?? 'HOST' };
      }

      // Try contains match as fallback
      response = await monitoredEntitiesClient.getEntities({
        entitySelector: `type("HOST"),entityName.contains("${hostName}")`,
        from: 'now-30d',
        pageSize: 5,
      });

      if (response.entities && response.entities.length === 1) {
        const e = response.entities[0];
        return { entityId: e.entityId ?? 'HOST', entityType: 'HOST', displayName: e.displayName ?? e.entityId ?? 'HOST' };
      }

      return null;
    } catch (err) {
      console.error(`Failed to resolve host: ${hostName}`, err);
      return null;
    }
  }

  async function processBulkHosts() {
    const hostNames = parseHostsList(bulkHostsInput);
    
    if (hostNames.length === 0) {
      setBulkHostsError('Please enter at least one host name.');
      return;
    }

    setIsResolvingHosts(true);
    setBulkHostsError('');

    const resolvedHosts: EntityReference[] = [];
    const unresolvedHosts: string[] = [];

    for (const hostName of hostNames) {
      const resolved = await resolveHostByName(hostName);
      if (resolved) {
        resolvedHosts.push(resolved);
      } else {
        unresolvedHosts.push(hostName);
      }
    }

    setIsResolvingHosts(false);

    if (unresolvedHosts.length > 0) {
      setBulkHostsError(`Could not find the following hosts: ${unresolvedHosts.join(', ')}`);
      return;
    }

    // Create filters for each resolved host
    const newFilters: EntityFilter[] = resolvedHosts.map(host => ({
      id: generateFilterId(),
      managementZones: [...bulkMZs],
      tags: [...bulkTags],
      entities: [host],
      underlyingOptions: {
        includeProcesses: bulkIncludeProcesses,
        includeServices: bulkIncludeServices,
        includeHosts: false,
        includeProcessGroups: false,
      },
    }));

    setFilters(prev => [...prev, ...newFilters]);
    closeBulkHostsModal();
  }

  function handleEntityQuickSelect(value: string) {
    setEntityQuickSelect(value);
    if (value !== 'OTHER') { setPendingEntityType(value); setEntityTypeSearchTerm(getEntityTypeLabel(value, entityTypes)); setPendingEntitySearch(''); setEntitySearchResults([]); setSelectedEntity(null); }
    else { setPendingEntityType(''); setEntityTypeSearchTerm(''); setPendingEntitySearch(''); setEntitySearchResults([]); setSelectedEntity(null); }
  }

  function renderChip(label: string, onRemove: () => void) {
    return (<span className="chip"><span className="chip-text">{label}</span><button onClick={onRemove} className="chip-remove">×</button></span>);
  }

  function renderUnderlyingOptions(filter: EntityFilter, entityType: string) {
    if (!ENTITY_TYPES_WITH_UNDERLYING.includes(entityType)) return null;
    const options = filter.underlyingOptions;
    if (entityType === 'HOST') {
      return (<div className="underlying-options-container"><Checkbox name={`${filter.id}-include-processes`} value={options.includeProcesses} onChange={(checked) => updateUnderlyingOption(filter.id, 'includeProcesses', checked)} className="entity-checkbox-1">Include its processes</Checkbox><Checkbox name={`${filter.id}-include-services`} value={options.includeServices} onChange={(checked) => updateUnderlyingOption(filter.id, 'includeServices', checked)} className="entity-checkbox-2">Include its services</Checkbox></div>);
    }
    if (entityType === 'PROCESS_GROUP') {
      return (<div className="underlying-options-container"><Checkbox name={`${filter.id}-include-hosts`} value={options.includeHosts} onChange={(checked) => updateUnderlyingOption(filter.id, 'includeHosts', checked)} className="entity-checkbox-1">Include its hosts</Checkbox><Checkbox name={`${filter.id}-include-services`} value={options.includeServices} onChange={(checked) => updateUnderlyingOption(filter.id, 'includeServices', checked)} className="entity-checkbox-2">Include its services</Checkbox></div>);
    }
    if (entityType === 'SERVICE') {
      return (<div className="underlying-options-container"><Checkbox name={`${filter.id}-include-hosts`} value={options.includeHosts} onChange={(checked) => updateUnderlyingOption(filter.id, 'includeHosts', checked)} className="entity-checkbox-1">Include its hosts</Checkbox><Checkbox name={`${filter.id}-include-pgs`} value={options.includeProcessGroups} onChange={(checked) => updateUnderlyingOption(filter.id, 'includeProcessGroups', checked)} className="entity-checkbox-2">Include its process groups</Checkbox></div>);
    }
    return null;
  }

  function renderFilterCard(filter: EntityFilter, index: number) {
    const isEditingMZ = editingMZFilterId === filter.id;
    const isEditingTag = editingTagFilterId === filter.id;
    const isEditingEntity = editingEntityFilterId === filter.id;
    const primaryEntityType = filter.entities.length > 0 ? filter.entities[0].entityType : null;

    return (
      <div key={filter.id} className="filter-card">
        <Flex justifyContent="space-between" alignItems="center" className="filter-card-header">
          <Flex justifyContent="space-between" alignItems="center" flex={1}><Button color="primary" variant="emphasized" size="condensed" className="btn-index">{index + 1}</Button><Text className="header-text-entity">Entity</Text><Paragraph /></Flex>
          <Flex flex={1} justifyContent="center"><Text>Management zones</Text></Flex>
          <Flex justifyContent="space-between" alignItems="center" flex={1}><Paragraph /><Text className="header-text-tags">Tags</Text><Button onClick={() => removeFilter(filter.id)} variant="emphasized" size="condensed" className="btn-remove"><DeleteIcon size="small" /></Button></Flex>
        </Flex>
        <div className="filter-content">
          <div className="filter-column filter-column-left">
            <div className="filter-chip-container-vertical">
              {!isEditingEntity && filter.entities.length == 0 && (<div className="filter-chips-wrap">{filter.entities.map(entity => renderChip(`${getEntityTypeLabel(entity.entityType, entityTypes)}: ${entity.displayName}`, () => removeEntityFromFilter(filter.id, entity.entityId)))}{!isEditingEntity && (<button onClick={() => startEditingEntity(filter.id)} className="inline-add-button inline-add-button-entity">+</button>)}</div>)}
              {filter.entities.length > 0 && (<div className="filter-chips-wrap-vertical">{filter.entities.map(entity => (<div key={entity.entityId} className="entity-chip-container">{renderChip(`${getEntityTypeLabel(entity.entityType, entityTypes)}: ${entity.displayName}`, () => removeEntityFromFilter(filter.id, entity.entityId))}</div>))}</div>)}
              {filter.entities.length > 0 && primaryEntityType && renderUnderlyingOptions(filter, primaryEntityType)}
              {filter.entities.length === 0 && isEditingEntity && (
                <div className="entity-type-editor">
                  {!entityQuickSelect && (<Flex gap={6} alignItems="center"><div className="input-entity-quick-select"><Select value={entityQuickSelect ?? ''} onChange={val => handleEntityQuickSelect(val as string)}><Select.Trigger placeholder="Select entity type" className="select-trigger-full" /><Select.Content className="select-content-entity-quick">{QUICK_ENTITY_TYPES.map(et => (<Select.Option key={et.value} value={et.value}><Paragraph>{et.label}</Paragraph></Select.Option>))}</Select.Content></Select></div><Button onClick={clearEntitySelection} variant="emphasized" color="critical" size="condensed" className="btn-small"><XmarkIcon className="icon-adjust" size="small" /></Button></Flex>)}
                  {entityQuickSelect === 'OTHER' && !pendingEntityType && (<div className="entity-type-search-container"><div className="entity-type-search-row"><TextInput value={entityTypeSearchTerm} onChange={setEntityTypeSearchTerm} placeholder="Search entity types..." className="text-input-flex" /><Button onClick={clearEntitySelection} variant="emphasized" color="critical" size="condensed" className="btn-small"><XmarkIcon className="icon-adjust" size="small" /></Button></div><div className="entity-type-dropdown">{filteredEntityTypes.length > 0 ? (filteredEntityTypes.map(et => (<div key={et.value} className="entity-type-option" onClick={() => { setPendingEntityType(et.value); setEntityTypeSearchTerm(et.label); setPendingEntitySearch(''); setEntitySearchResults([]); setSelectedEntity(null); }}><span className="entity-type-option-label">{et.label}</span><span className="entity-type-option-id">{et.value}</span></div>))) : (<div className="no-results-message">No matching entity types.</div>)}</div></div>)}
                  {pendingEntityType && (<>
                    {!selectedEntity && (<Flex flexDirection="column" gap={6} className="entity-search-wrapper"><Flex gap={6} alignItems="center" className="entity-search-wrapper" flex={1}><span className="chip-editing"><Flex justifyContent="space-between" gap={12} flex={1}><Flex><span className="chip-text-entity-type">{entityTypeSearchTerm}</span></Flex><Flex justifyContent="flex-end"><Button onClick={() => { setPendingEntityType(''); setEntityTypeSearchTerm(''); setPendingEntitySearch(''); setEntitySearchResults([]); setSelectedEntity(null); if (entityQuickSelect !== 'OTHER') { setEntityQuickSelect(null); } }} size="condensed" className="chip-edit"><EditIcon size="small" /></Button></Flex></Flex></span><Button onClick={clearEntitySelection} variant="emphasized" color="critical" size="condensed" className="btn-small"><XmarkIcon className="icon-adjust" size="small" /></Button></Flex><div className="input-entity-search"><TextInput value={pendingEntitySearch} onChange={val => { setPendingEntitySearch(val); setSelectedEntity(null); }} placeholder="Search by name..." />{isSearchingEntities && (<div className="spinner-overlay"><ProgressCircle size="small" /></div>)}</div></Flex>)}
                    {entitySearchResults.length > 0 && !selectedEntity && (<div className="entity-search-dropdown">{entitySearchResults.map(entity => (<div key={entity.entityId} className="entity-search-option" onClick={() => setSelectedEntity(entity)}><span className="entity-search-name">{entity.displayName}</span><span className="entity-search-id">{entity.entityId}</span></div>))}</div>)}
                    {pendingEntitySearch.length >= 1 && !isSearchingEntities && entitySearchResults.length === 0 && !selectedEntity && (<Text className="text-small-secondary">No entities found.</Text>)}
                    {selectedEntity && (<Flex gap={6} alignItems="center"><span className="chip"><span className="chip-text">{getEntityTypeLabel(selectedEntity.entityType, entityTypes)}: {selectedEntity.displayName}</span></span><Button onClick={() => addEntityToFilter(filter.id)} variant="emphasized" color="success" size="condensed" className="btn-small"><CheckmarkIcon className="icon-adjust" size="small" /></Button><Button onClick={() => { setSelectedEntity(null); setPendingEntitySearch(''); }} variant="emphasized" color="critical" size="condensed" className="btn-small"><XmarkIcon className="icon-adjust" size="small" /></Button></Flex>)}
                  </>)}
                </div>
              )}
            </div>
          </div>
          <div className="filter-column filter-column-left">
            <div className="filter-chip-container-vertical">
              {!isEditingMZ && filter.managementZones.length == 0 && (<div className="filter-chips-wrap">{filter.managementZones.map(mz => renderChip(mz.name, () => removeMZFromFilter(filter.id, mz.id)))}{!isEditingMZ && (<button onClick={() => startEditingMZ(filter.id)} className="inline-add-button">+</button>)}</div>)}
              {filter.managementZones.length > 0 && (<div className="filter-chips-wrap">{filter.managementZones.map(mz => renderChip(mz.name, () => removeMZFromFilter(filter.id, mz.id)))}{!isEditingMZ && (<button onClick={() => startEditingMZ(filter.id)} className="inline-add-button">+</button>)}</div>)}
              {isEditingMZ && (<Flex gap={6} alignItems="center" className="filter-add-row"><div className="input-mz"><Select value={pendingMZSelection} onChange={val => setPendingMZSelection(val as string)}><Select.Trigger placeholder="Select a management zone" className="select-trigger-truncate" /><Select.Content className="select-content-mz">{managementZones.map(mz => (<Select.Option key={mz.id} value={mz.id}><span className="select-option-truncate">{mz.name}</span></Select.Option>))}</Select.Content></Select></div><Button onClick={() => addMZToFilter(filter.id)} variant="emphasized" color="success" size="condensed" className="btn-small"><CheckmarkIcon className="icon-adjust" size="small" /></Button><Button onClick={() => setEditingMZFilterId(null)} variant="emphasized" color="critical" size="condensed" className="btn-small"><XmarkIcon className="icon-adjust" size="small" /></Button></Flex>)}
            </div>
          </div>
          <div className="filter-column">
            <div className="filter-chip-container-vertical">
              {!isEditingTag && filter.tags.length == 0 && (<div className="filter-chips-wrap">{filter.tags.map((tag, idx) => renderChip(tag.value ? `${tag.key}:${tag.value}` : tag.key, () => removeTagFromFilter(filter.id, idx)))}{!isEditingTag && (<button onClick={() => startEditingTag(filter.id)} className="inline-add-button inline-add-button-tag">+</button>)}</div>)}
              {filter.tags.length > 0 && (<div className="filter-chips-wrap">{filter.tags.map((tag, idx) => renderChip(tag.value ? `${tag.key}:${tag.value}` : tag.key, () => removeTagFromFilter(filter.id, idx)))}{!isEditingTag && (<button onClick={() => startEditingTag(filter.id)} className="inline-add-button inline-add-button-tag">+</button>)}</div>)}
              {isEditingTag && (<Flex gap={6} alignItems="center" className="filter-add-row"><div className="input-tag"><TextInput value={pendingTagKey} onChange={setPendingTagKey} placeholder="Key" /></div><div className="input-tag"><TextInput value={pendingTagValue} onChange={setPendingTagValue} placeholder="Value" /></div><Button onClick={() => addTagToFilter(filter.id)} variant="emphasized" color="success" size="condensed" className="btn-small"><CheckmarkIcon className="icon-adjust" size="small" /></Button><Button onClick={() => setEditingTagFilterId(null)} variant="emphasized" color="critical" size="condensed" className="btn-small"><XmarkIcon className="icon-adjust" size="small" /></Button></Flex>)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Flex flexDirection="column" gap={8} padding={12} className="page-container">
      <Flex justifyContent="space-between" alignItems="center">
        <Flex alignItems="center" className="search-container" gap={16}><TextInput placeholder="Search by name..." value={searchTerm} onChange={setSearchTerm} className="search-input" /></Flex>
        <Button color="primary" variant="accent" onClick={openCreateModal} className="btn-unshrinkable"><PlusIcon className="icon-btn-large" /><Text textStyle="base-emphasized" className="btn-large-text"> New maintenance window</Text></Button>
      </Flex>
      {isLoading ? (<Flex justifyContent="center" alignItems="center" className="table-loading"><ProgressCircle /></Flex>) : (<DataTable data={pageData} columns={columns} className="table-container" variant={{ verticalDividers: true, verticalAlignment: { header: 'center', body: 'center' } }} fullWidth sortable resizable />)}
      <Flex justifyContent="space-between" alignItems="center">
        <Switch value={showDisabled} onChange={setShowDisabled}>Show disabled maintenance windows</Switch>
        <Paragraph className="text-count">{filteredWindows.length} of {windows.length} maintenance windows</Paragraph>
      </Flex>

      <Modal show={isCreateModalOpen} onDismiss={closeCreateModal} title="New maintenance window" size="large" dismissible={false} className="modal">
        <Flex flexDirection="column" className="modal-body">
          <div className="modal-scroll-area">
            <Flex flexDirection="column" gap={24}>
              <Flex gap={16} className="form-row-offset">
                <FormField className="form-field-half"><Label className="form-label">Name *</Label><TextInput value={name} onChange={setName} placeholder="Maintenance window name" /></FormField>
                <FormField className="form-field-half"><Label className="form-label">Description</Label><TextInput value={description} onChange={setDescription} placeholder="Optional description" /></FormField>
              </Flex>
              <Flex gap={16}>
                <FormField className="form-field-date"><Label className="form-label">Start *</Label><DateTimePicker value={startDateTime} onChange={(val: any) => setStartDateTime(val === null ? null : typeof val === 'string' ? val : val?.value ?? null)} /></FormField>
                <FormField className="form-field-date"><Label className="form-label">End *</Label><DateTimePicker value={endDateTime} onChange={(val: any) => setEndDateTime(val === null ? null : typeof val === 'string' ? val : val?.value ?? null)} /></FormField>
                <FormField className="form-field-tz"><Label className="form-label">Time zone *</Label><Select value={timezone} onChange={val => setTimezone(val as string)}><Select.Trigger className="select-trigger-full" /><Select.Content className="select-content-tz">{TIMEZONE_OPTIONS.map(tz => (<Select.Option key={tz.id} value={tz.id}><Flex justifyContent="space-between" alignContent="center" className="tz-option-content"><Paragraph>UTC {tz.offset}</Paragraph><Paragraph>{tz.city}</Paragraph></Flex></Select.Option>))}</Select.Content></Select></FormField>
                <FormField className="form-field-recurrence"><Label className="form-label">Recurrence *</Label><Select value="once"><Select.Trigger className="select-trigger-full" /><Select.Content className="select-content-recurrence"><Select.Option value="once"><Paragraph>Once</Paragraph></Select.Option><Select.Option value="daily" disabled><Paragraph>Daily</Paragraph></Select.Option><Select.Option value="weekly" disabled><Paragraph>Weekly</Paragraph></Select.Option><Select.Option value="monthly" disabled><Paragraph>Monthly</Paragraph></Select.Option></Select.Content></Select></FormField>
              </Flex>
              <div className="suppression-row">
                <FormField className="form-field-suppression"><Label className="form-label">Problem detection and alerting *</Label><RadioGroup value={suppression} onChange={setSuppression}><Flex gap={24}>{SUPPRESSION_OPTIONS.map(opt => <Radio key={opt.value} value={opt.value}>{opt.label}</Radio>)}</Flex></RadioGroup></FormField>
                <FormField className="form-field-synthetics"><Label className="form-label">Disable synthetic monitors *</Label><RadioGroup value={disableSynthetics} onChange={setDisableSynthetics}><Flex gap={24}><Radio value="yes">Yes</Radio><Radio value="no">No</Radio></Flex></RadioGroup></FormField>
              </div>
              <Divider />
              <div>
                <Text className="form-label">Entities</Text>
                <span className="filter-section-hint">Add monitored entities to your maintenance window using filters. A filter can include a specific entity, or it can include groups of entities using management zones, tags, or both. Entities must meet all conditions of a filter to be included in your maintenance window.</span>
                <Flex flexDirection="column" gap={12}>
                  {filters.length === 0 ? (<div className="empty-filter-placeholder"><Text className="text-hint">No entities added. Add entity filters to specify which entities will be included in your maintenance window.</Text></div>) : (filters.map((filter, index) => renderFilterCard(filter, index)))}
                  <Flex gap={8}>
                    <Button variant="emphasized" size="condensed" color="primary" onClick={addFilter} className="btn-add-group"><PlusIcon size="small" className="icon-btn-small" /><Text> Add entity filter</Text></Button>
                    <Button variant="emphasized" size="condensed" color="primary" onClick={openBulkHostsModal} className="btn-add-group"><PlusIcon size="small" className="icon-btn-small" /><Text> Add hosts in bulk</Text></Button>
                  </Flex>
                </Flex>
              </div>
            </Flex>
          </div>
          <Flex justifyContent="space-between" alignItems="center" className="modal-footer">
            <Flex className="modal-footer-link"><ExternalLink href="https://docs.dynatrace.com/docs/analyze-explore-automate/notifications-and-alerting/maintenance-windows">Learn more about maintenance windows</ExternalLink></Flex>
            <Flex justifyContent="flex-end" gap={12} className="modal-footer-buttons">
              <Button variant="emphasized" onClick={closeCreateModal}><Flex gap={4}><DeleteIcon className="icon-btn-large" /><Text textStyle="base-emphasized" className="btn-large-text">Discard</Text></Flex></Button>
              <Button variant="accent" color="primary" onClick={saveMaintenanceWindow} disabled={isSaving}><Flex gap={4}><SaveIcon className="icon-btn-large" /><Text textStyle="base-emphasized" className="btn-large-text">{isSaving ? <ProgressCircle size="small" /> : 'Save'}</Text></Flex></Button>
            </Flex>
          </Flex>
        </Flex>
      </Modal>

      <Modal show={isSuccessModalOpen} onDismiss={() => setIsSuccessModalOpen(false)} title="Success">
        <Flex flexDirection="column" padding={16} gap={16}>
          <Paragraph>Maintenance window created successfully!</Paragraph>
          <Flex justifyContent="flex-end" gap={8}>
            <Button variant="default" onClick={() => { setIsSuccessModalOpen(false); openCreateModal(); }}>Create Another</Button>
            <Button variant="accent" color="primary" onClick={() => setIsSuccessModalOpen(false)}>Done</Button>
          </Flex>
        </Flex>
      </Modal>

      <Modal show={isErrorModalOpen} onDismiss={() => setIsErrorModalOpen(false)} title="Error">
        <Flex flexDirection="column" padding={16} gap={16}>
          <Text><div dangerouslySetInnerHTML={{ __html: errorMessage }} /></Text>
          <Flex justifyContent="flex-end"><Button variant="accent" color="primary" onClick={() => setIsErrorModalOpen(false)}>OK</Button></Flex>
        </Flex>
      </Modal>

      {/* Bulk Hosts Modal */}
      <Modal show={isBulkHostsModalOpen} onDismiss={closeBulkHostsModal} title="Add hosts in bulk" size="medium">
        <Flex flexDirection="column" className="bulk-modal-content">
          <div className="bulk-modal-scroll">
            <Flex flexDirection="column" gap={20}>
              {/* Instructions */}
              <div className="bulk-instructions">
                <Text className="bulk-instructions-text">
                  Enter host names below, separated by commas, spaces, or new lines.<br/>
                  You can use either the host's name as it appears in Dynatrace or its fully qualified domain name.<br/>
                  Each host will be added as its own entity filter with the management zones and tags you specify.
                </Text>
              </div>

              {/* Host input */}
              <FormField>
                <Label className="form-label">Host names *</Label>
                <TextArea
                  className="bulk-textarea"
                  value={bulkHostsInput}
                  resize="vertical"
                  onChange={(value) => setBulkHostsInput(value)}
                  placeholder="Enter host names here...&#10;&#10;host1.example.com&#10;host2.example.com&#10;host1, host2, host3"
                  rows={6}
                />
              </FormField>

              {/* Underlying options */}
              <div>
                <Label className="form-label">Processes and services</Label>
                <div className="bulk-checkbox-group">
                  <Checkbox name="bulk-include-processes" value={bulkIncludeProcesses} onChange={(checked) => setBulkIncludeProcesses(checked)} className="bulk-checkbox">
                    Include processes running on these hosts
                  </Checkbox>
                  <Checkbox name="bulk-include-services" value={bulkIncludeServices} onChange={(checked) => setBulkIncludeServices(checked)}>
                    Include services running on these hosts
                  </Checkbox>
                </div>
              </div>

              
              <Divider />

              {/* Two column layout for MZs and Tags */}
              <Flex gap={24} className="bulk-columns">
                {/* Management Zones */}
                <div className="bulk-column">
                  <Label className="form-label">Management zones (optional)</Label>
                  <Flex gap={6} alignItems="center" className="bulk-add-row">
                    <div className="bulk-select-container">
                      <Select value={bulkPendingMZ} onChange={val => setBulkPendingMZ(val as string)}>
                        <Select.Trigger placeholder="Select management zone" className="select-trigger-full" />
                        <Select.Content className="select-content-mz">
                          {managementZones.map(mz => (
                            <Select.Option key={mz.id} value={mz.id}>
                              <span className="select-option-truncate">{mz.name}</span>
                            </Select.Option>
                          ))}
                        </Select.Content>
                      </Select>
                    </div>
                    {bulkPendingMZ && (
                      <Button onClick={addBulkMZ} variant="emphasized" color="success" size="condensed" className="btn-small">
                        <CheckmarkIcon className="icon-adjust" size="small" />
                      </Button>
                    )}
                  </Flex>
                  {bulkMZs.length > 0 && (
                    <div className="bulk-chips-area">
                      {bulkMZs.map(mz => (
                        <span key={mz.id} className="chip">
                          <span className="chip-text">{mz.name}</span>
                          <button onClick={() => removeBulkMZ(mz.id)} className="chip-remove">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div className="bulk-column">
                  <Label className="form-label">Tags (optional)</Label>
                  <Flex gap={6} alignItems="center" className="bulk-add-row">
                    <div className="input-tag">
                      <TextInput value={bulkPendingTagKey} onChange={setBulkPendingTagKey} placeholder="Key" />
                    </div>
                    <div className="input-tag">
                      <TextInput value={bulkPendingTagValue} onChange={setBulkPendingTagValue} placeholder="Value" />
                    </div>
                    {bulkPendingTagKey && bulkPendingTagValue && (
                      <Button onClick={addBulkTag} variant="emphasized" color="success" size="condensed" className="btn-small">
                        <CheckmarkIcon className="icon-adjust" size="small" />
                      </Button>
                    )}
                  </Flex>
                  {bulkTags.length > 0 && (
                    <div className="bulk-chips-area">
                      {bulkTags.map((tag, idx) => (
                        <span key={idx} className="chip">
                          <span className="chip-text">{tag.value ? `${tag.key}:${tag.value}` : tag.key}</span>
                          <button onClick={() => removeBulkTag(idx)} className="chip-remove">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Flex>

              {/* Error message */}
              {bulkHostsError && (
                <div className="bulk-error">
                  <Text className="bulk-error-text">{bulkHostsError}</Text>
                </div>
              )}
            </Flex>
          </div>

          {/* Modal footer */}
          <Flex justifyContent="flex-end" gap={12} className="bulk-modal-footer">
            <Button variant="emphasized" onClick={closeBulkHostsModal}>Cancel</Button>
            <Button variant="accent" color="primary" onClick={processBulkHosts} disabled={isResolvingHosts}>
              {isResolvingHosts ? <Flex gap={8} alignItems="center"><ProgressCircle size="small" /><Text>Resolving hosts...</Text></Flex> : 'Add hosts'}
            </Button>
          </Flex>
        </Flex>
      </Modal>

      <DetailsModal window={detailsWindow} managementZones={managementZones} entityTypes={entityTypes} onClose={() => setDetailsWindow(null)} />
    </Flex>
  );
};