<template>
  <div class="stats-search">
    <base-toast-message :type="toastType" :show="toastDisplayed">
      <template #title>
        {{ toastTitle }}
      </template>
      <template #default>
        {{ toastContent }}
      </template>
    </base-toast-message>
    <div class="stats-search__search-group">
      <h2>Search for the server you want to retrieve stats for</h2>
      <div class="stats-search__search-bar">
        <input
          type="text"
          name=""
          id=""
          placeholder="guild id or name"
          v-model="searchInput"
        />
      </div>
    </div>
    <div class="stats-search__results">
      <div class="stats-search__matches" v-if="gotResults">
        <guild-info-card
          v-for="guild in results"
          :key="guild.id"
          :id="guild.id"
          :name="guild.name"
          :iconUrl="guild.icon"
          :isBookmark="false"
          :isBookmarked="guild.isBookmarked"
          @toggle-bookmark="handleBookmarkToggle"
        />
      </div>
      <div class="stats-search__matches-left" v-if="resultsLeft">
        {{ resultsLeftMessage }}
      </div>
      <div class="stats-search__no-results" v-if="noResults">
        <h1>No Results</h1>
      </div>
      <div class="stats-search__start" v-if="!gotResults && !noResults">
        <h1>Start to search</h1>
        <h2>Your results will appear here</h2>
      </div>
    </div>

    <div class="stats-search__bookmarks">
      <h1>Bookmarks</h1>
      <div v-if="bookmarks.length">
        <guild-info-card
          v-for="bookmark in bookmarks"
          :key="bookmark.id"
          :id="bookmark.id"
          :name="bookmark.name"
          :iconUrl="bookmark.icon"
          :isBookmark="true"
          :isBookmarked="true"
          @toggle-bookmark="handleBookmarkToggle"
        />
      </div>
      <div v-else>
        <h2>No bookmarks stored</h2>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import postApi from "@/store/postApi";
import { GuildBookmark, rootKey } from "@/store/types";
import { debounce } from "@/util";
import { useStore } from "vuex";
import { computed, defineComponent, ref, watch } from "vue";
import { useToast } from "@/composables/useToast";
import GuildInfoCard from "@/components/stats/GuildInfoCard.vue";

export default defineComponent({
  components: { GuildInfoCard },
  setup() {
    const {
      toastType,
      toastTitle,
      toastContent,
      toastDisplayed,
      createToast,
    } = useToast();

    const searchInput = ref();
    const results = ref([]);
    const resultsLeft = ref(0);
    const noResults = ref(false);

    // Load bookmarks
    const store = useStore(rootKey);
    const bookmarks = ref<GuildBookmark[]>([]);

    // No fetching done yet
    if (store.getters["stats/gotBookmarkedGuilds"] === null) {
      (async () => {
        await store.dispatch("stats/fetchGuildBookmarks");
        bookmarks.value = store.getters["stats/getBookmarkedGuilds"];
      })();
    } else if (store.getters["stats/gotBookmarkedGuilds"]) {
      bookmarks.value = store.getters["stats/getBookmarkedGuilds"];
    }

    const handleBookmarkToggle = (infoObj) => {
      const storedBookmark = bookmarks.value.find((b) => b.id === infoObj.id);
      const searchResult = results.value.find((r) => r.id === infoObj.id);

      // Stored, remove it
      if (storedBookmark) {
        store.dispatch("stats/removeGuildBookmark", infoObj.id);
        bookmarks.value = store.getters["stats/getBookmarkedGuilds"];
        createToast(
          "warn",
          "Bookmark removed",
          `Removed bookmarked server ${infoObj.name}`,
          3000
        );

        if (searchResult) {
          searchResult.isBookmarked = false;
        }
      } else {
        if (bookmarks.value.length >= 6) {
          createToast(
            "warn",
            "Exceeded bookmark count",
            "Only six bookmarks are able to be stored",
            3000
          );
          return;
        }
        store.dispatch("stats/addGuildBookmark", infoObj);
        createToast(
          "success",
          "Bookmark added",
          `Bookmarked server ${infoObj.name}`,
          3000
        );

        if (searchResult) {
          searchResult.isBookmarked = true;
        }
      }
    };

    const resultsLeftMessage = computed(
      () =>
        `${resultsLeft.value} more result${
          resultsLeft.value > 1 ? "s" : ""
        } left`
    );
    const gotResults = computed(() => results.value.length > 0);

    const isBookmarked = (guildId) =>
      bookmarks.value.find((b) => b.id === guildId) ? true : false;

    watch(
      searchInput,
      debounce(async (newValue, oldValue) => {
        if (!newValue.length) {
          results.value = [];
          noResults.value = false;
          resultsLeft.value = 0;
          return;
        }

        const response = await postApi("search", { query: searchInput.value });
        if (response && response.status === "success" && response.sent) {
          noResults.value = false;
          resultsLeft.value = response.left;
          results.value = response.matches.map((r) => ({
            ...r,
            isBookmarked: bookmarks.value.find((b) => b.id === r.id)
              ? true
              : false,
          }));
        } else {
          resultsLeft.value = 0;
          noResults.value = true;
          results.value = [];
        }
      }, 500)
    );

    return {
      searchInput,
      noResults,
      gotResults,
      results,
      bookmarks,
      isBookmarked,
      handleBookmarkToggle,
      resultsLeft,
      resultsLeftMessage,
      toastType,
      toastDisplayed,
      toastTitle,
      toastContent,
    };
  },
});
</script>


<style lang="scss" scoped>
.stats-search {
  height: calc(90vh - 4.5rem);
  display: flex;
  flex-flow: column;
  justify-content: space-around;
  align-items: center;

  &__bookmarks {
    h1 {
      text-align: center;
      margin-bottom: 1rem;
    }

    h1,
    h2 {
      font-weight: 400;
    }

    & > div {
      display: flex;
    }

    & div:not(:last-child) {
      margin-right: 1rem;
    }
  }

  &__start {
    h1,
    h2 {
      font-weight: 400;
    }

    h1 {
      text-align: center;
    }
  }

  &__no-results {
    h1 {
      font-weight: 400;
    }
  }

  &__matches {
    display: flex;

    & div {
      margin-right: 1rem;
    }

    &-left {
      text-align: center;
      margin-top: 1rem;
      font-size: 2rem;
    }
  }

  &__search-group {
    h2 {
      font-size: 2rem;
      font-weight: 400;
      margin-bottom: 1rem;
    }
  }

  &__search-bar {
    input {
      width: 100%;
      padding: 0.5rem 1rem;
      font-size: 2rem;
      outline: 1px solid $blue;
      border-radius: 3px;
      background-color: $white;
    }
  }
}
</style>