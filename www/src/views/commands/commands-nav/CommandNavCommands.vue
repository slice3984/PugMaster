<template>
  <div class="command-nav__commands">
    <ul>
      <nav-link
        v-for="link in displayedCommands"
        :key="link"
        :title="link"
        route="commands"
        :id="link"
      >
        {{ link }}
      </nav-link>
    </ul>
  </div>
</template>

<script lang="ts">
import NavLink from "@/components/NavLink.vue";
import { computed, ComputedRef, defineComponent, ref } from "vue";
import { CommandCategory } from "../../../store/types";

export default defineComponent({
  props: {
    categories: {
      type: Object as () => CommandCategory[],
      required: true,
    },
    activeCategory: String,
  },
  components: { NavLink },
  setup(props) {
    const commandCategories: ComputedRef<CommandCategory[]> = computed(
      () => props.categories
    );

    const categoryNames: ComputedRef<string[]> = computed(() =>
      commandCategories.value.map((c) => c.category)
    );

    const displayedCommands: ComputedRef<string[]> = computed(() => {
      const category = commandCategories.value.find(
        (c) => c.category === props.activeCategory
      );
      return category ? category.commands : [];
    });

    return {
      commandCategories,
      categoryNames,
      displayedCommands,
    };
  },
});
</script>

<style lang="scss" scoped>
.command-nav {
  &__commands {
    & ul li {
      font-size: 2rem;
      margin-left: 2rem;
      list-style-type: none;

      &:not(:last-child) {
        margin-bottom: 0.75rem;
      }
    }
  }
}
</style>