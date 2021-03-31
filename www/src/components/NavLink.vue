<template>
  <li :class="isActive">
    <base-link :to="`/${route}/${id}`">{{ title }}</base-link>
  </li>
</template>

<script lang="ts">
import { computed } from "vue";
import { defineComponent } from "vue";

export default defineComponent({
  props: ["active-link", "title", "id", "route", "section"],
  setup(props) {
    const isActive = computed(() =>
      props["active-link"] === props.id ? "active-help-point" : null
    );

    return {
      isActive,
      title: props.title,
      id: props.id,
      rote: props.route,
    };
  },
});
</script>

<style lang="scss" scoped>
li {
  cursor: pointer;

  & a {
    color: darken($white, 10);
  }

  & .router-link-active {
    color: $red;
  }

  &:hover {
    text-decoration: underline;
  }
}

.active-help-point {
  font-weight: 800;
  color: $red;
}
</style>