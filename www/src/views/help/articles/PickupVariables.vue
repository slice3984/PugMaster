<template>
  <div class="wrapper">
    <help-article>
      <template #title>Pickup variables</template>
      <template #default>
        <div class="help-article__section">
          <table class="help-article__table">
            <thead>
              <th>Property</th>
              <th>Description</th>
              <th>Type</th>
              <th>Restriction</th>
            </thead>
            <tbody>
              <tr>
                <td>name</td>
                <td>Name of the pickup</td>
                <td>
                  <div class="help-article__type help-article__type--string">
                    String
                  </div>
                </td>
                <td>1 to 20 chars long</td>
              </tr>
              <tr>
                <td>players</td>
                <td>Player count for the pickup</td>
                <td>
                  <div class="help-article__type help-article__type--number">
                    Number
                  </div>
                </td>
                <td>2 to 100</td>
              </tr>
              <tr>
                <td>teams</td>
                <td>Team count for the pickup</td>
                <td>
                  <div class="help-article__type help-article__type--number">
                    Number
                  </div>
                </td>
                <td>2 to 10</td>
              </tr>
              <tr>
                <td>default</td>
                <td>Default property</td>
                <td>
                  <div class="help-article__type help-article__type--bool">
                    Boolean
                  </div>
                </td>
                <td>true or false</td>
              </tr>
              <tr>
                <td>mappool<span class="help-article__red">*</span></td>
                <td>Map pool for the pickup</td>
                <td>
                  <div class="help-article__type help-article__type--string">
                    String
                  </div>
                </td>
                <td>Valid stored map pool</td>
              </tr>
              <tr>
                <td>mapvote</td>
                <td>Enables or disables map votes for the pickup</td>
                <td>
                  <div class="help-article__type help-article__type--bool">
                    Boolean
                  </div>
                </td>
                <td>true or false</td>
              </tr>
              <tr>
                <td>afkcheck</td>
                <td>Specifies if the AFK check for the pickup is enabled</td>
                <td>
                  <div class="help-article__type help-article__type--bool">
                    Boolean
                  </div>
                </td>
                <td>true or false</td>
              </tr>
              <tr>
                <td>pickmode</td>
                <td>Specifies the pick mode for the pickup</td>
                <td>
                  <div class="help-article__type help-article__type--string">
                    String
                  </div>
                </td>
                <td>Has to be no_teams, manual, random, elo or autopick</td>
              </tr>
              <tr>
                <td>rated</td>
                <td>If the pickup can be rated</td>
                <td>
                  <div class="help-article__type help-article__type--bool">
                    Boolean
                  </div>
                </td>
                <td>true or false</td>
              </tr>
              <tr>
                <td>whitelist<span class="help-article__red">*</span></td>
                <td>Only allow players with this role to add</td>
                <td>
                  <div class="help-article__type help-article__type--mention">
                    Role
                  </div>
                </td>
                <td>Role mention, id or name</td>
              </tr>
              <tr>
                <td>blacklist<span class="help-article__red">*</span></td>
                <td>Disallow players with this role to add</td>
                <td>
                  <div class="help-article__type help-article__type--mention">
                    Role
                  </div>
                </td>
                <td>Role mention, id or name</td>
              </tr>
              <tr>
                <td>promotion<span class="help-article__red">*</span></td>
                <td>Role used to promote this pickup</td>
                <td>
                  <div class="help-article__type help-article__type--mention">
                    Role
                  </div>
                </td>
                <td>Role mention, id or name</td>
              </tr>
              <tr>
                <td>captain<span class="help-article__red">*</span></td>
                <td>Captain role used for picking</td>
                <td>
                  <div class="help-article__type help-article__type--mention">
                    Role
                  </div>
                </td>
                <td>Role mention, id or name</td>
              </tr>
              <tr>
                <td>server<span class="help-article__red">*</span></td>
                <td>Server for this pickup</td>
                <td>
                  <div class="help-article__type help-article__type--string">
                    String
                  </div>
                </td>
                <td>Valid stored server</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p>
          <span class="help-article__red">*</span>Can be none to disable / clear
        </p>
        <p>
          Variables which are used for the
          <base-link to="#" mode="bold">to be replaced</base-link>
          command
        </p>
      </template>
    </help-article>
  </div>
</template>

<script lang="ts">
import { defineComponent } from "vue";
import HelpArticle from "@/components/help/HelpArticle.vue";

export default defineComponent({
  components: { HelpArticle },
});
</script>

<style lang="scss" scoped>
.wrapper {
  width: 60vw;
}
</style>