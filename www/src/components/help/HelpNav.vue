<template>
  <div class="help-nav">
    <ul v-for="section in sections" :key="section.name" class="help-section">
      <li>{{ section.name }}</li>
      <ul>
        <help-link
          v-for="link in section.links"
          :key="link.id"
          :active-link="activeLink"
          :title="link.title"
          :id="link.id"
        ></help-link>
      </ul>
    </ul>
  </div>
</template>

<script lang="ts">
import { HelpNavSection } from "@/store/types";
import { defineComponent, ref } from "vue";

import HelpLink from "./HelpLink.vue";

export default defineComponent({
  components: { HelpLink },
  props: {
    helpNavSections: {
      type: Object as () => HelpNavSection[],
      required: true,
    },
    activePoint: {
      type: String,
      required: false,
    },
  },
  setup(props) {
    return {
      sections: props.helpNavSections,
      activeLink: props.activePoint,
    };
  },
});
</script>

<style lang="scss" scoped>
.help-nav {
  & > ul {
    list-style: none;
  }
}
.help-section {
  margin-bottom: 2rem;

  & > li {
    font-size: 1.75rem;
    text-transform: capitalize;
    margin-bottom: 1rem;
  }

  & ul li {
    font-size: 1.5rem;
    margin-left: 2rem;
    list-style-type: none;

    &:not(:last-child) {
      margin-bottom: 1rem;
    }
  }
}
</style>