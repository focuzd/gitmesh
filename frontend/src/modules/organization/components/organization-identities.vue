<template>
  <div class="flex items-center gap-3">
    <template v-if="organization && Array.isArray(organization.identities) && organization.identities.length > 0">
      <div class="flex items-center gap-2">
        <div v-for="platform of platforms" :key="platform">
          <app-platform
            :platform="platform"
            :username-handles="getHandlesByPlatform(platform)"
            :links="getUrlsByPlatform(platform)"
            :track-event-name="getPlatformDetails(platform)?.trackEventName"
            :track-event-channel="getPlatformDetails(platform)?.trackEventChannel"
            :tooltip-label="getPlatformDetails(platform)?.tooltipLabel"
            :show-handles-badge="true"
            :as-link="getUrlsByPlatform(platform).length ? getUrlsByPlatform(platform)[0] : false"
            custom-platform-icon-class="ri-community-fill"
          />
        </div>
        <el-divider
          v-if="showDivider"
          direction="vertical"
          class="border-gray-200 m-0 h-8"
        />
        <div v-if="organization.phoneNumbers && organization.phoneNumbers.length" class="flex items-center gap-2">
          <!-- Phone numbers -->
          <app-platform
            platform="phone"
            track-event-name="Click Organization Contact"
            track-event-channel="Phone"
            :has-tooltip="true"
            tooltip-label="Call"
            :href="`tel:${organization.phoneNumbers[0]}`"
            :as-link="true"
          />
        </div>
      </div>
    </template>
    <template v-else-if="!organization">
      <div class="text-gray-400 italic">Organization not found.</div>
    </template>
    <template v-else>
      <div class="text-gray-400 italic">No organization identities found.</div>
    </template>
  </div>
</template>

<script setup>
import { withHttp } from '@/utils/string';
import { defineProps, computed } from 'vue';
import { GitmeshIntegrations } from '@/integrations/integrations-config';

const props = defineProps({
  organization: {
    type: Object,
    required: true,
  },
});

const platforms = computed(() => {
  if (!props.organization || !Array.isArray(props.organization.identities)) {
    return [];
  }
  return [...new Set(props.organization.identities
    .map((i) => i.platform)
    .filter(platform => platform != null)
  )];
});

const getHandlesByPlatform = (platform) => {
  if (!props.organization || !Array.isArray(props.organization.identities)) return [];
  return props.organization.identities
    .filter((i) => i.platform === platform)
    .map((i) => {
      const platformDetails = getPlatformDetails(i.platform);
      if (platformDetails?.organization?.handle) {
        return platformDetails.organization.handle(i);
      }
      return platformDetails?.name ?? i.platform;
    });
};
const getUrlsByPlatform = (platform) => {
  if (!props.organization || !Array.isArray(props.organization.identities)) return [];
  return props.organization.identities
    .filter((i) => i.platform === platform)
    .map((i) => getIdentityLink(i));
};

const showDivider = computed(
  () => !!props.organization?.phoneNumbers?.length
    && platforms.value?.length > 0,
);

const getPlatformDetails = (platform) => GitmeshIntegrations.getConfig(platform);

const getIdentityLink = (identity) => {
  if (identity.url) {
    return withHttp(identity.url);
  }
  return null;
};
</script>

<script>
export default {
  name: 'AppOrganizationIdentities',
};
</script>
