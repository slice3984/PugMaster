<template>
  <div>
    <component :is="article"></component>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from "vue";

// Articles
import FirstSteps from "./articles/FirstSteps.vue";
import Settings from "./articles/Settings.vue";
import RatingSetup from "./articles/RatingSetup.vue";

import BotVariables from "./articles/BotVariables.vue";
import PickupVariables from "./articles/PickupVariables.vue";

import Introduction from "./articles/Introduction.vue";
import Permissions from "./articles/Permissions.vue";
import RatingHelp from "./articles/RatingHelp.vue";
import PickModes from "./articles/PickModes.vue";
import BotMessages from "./articles/BotMessages.vue";

export default defineComponent({
  components: {
    firststeps: FirstSteps,
    settings: Settings,
    ratingsetup: RatingSetup,
    botvariables: BotVariables,
    pickupvariables: PickupVariables,
    introduction: Introduction,
    permissions: Permissions,
    ratinghelp: RatingHelp,
    pickmodes: PickModes,
    botmessages: BotMessages,
  },
  props: ["article"],
  setup(props) {
    return {
      article: props.article,
      FirstSteps,
      Settings,
      RatingSetup,
      BotVariables,
      PickupVariables,
      Introduction,
      Permissions,
      RatingHelp,
      PickModes,
      BotMessages,
    };
  },
});
</script>