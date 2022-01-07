<template>
  <div class="wrapper">
    <help-article>
      <template #title>Bot variables</template>
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
                <td>prefix</td>
                <td>Bot command prefix</td>
                <td>
                  <div class="help-article__type help-article__type--string">
                    String
                  </div>
                </td>
                <td>1 to 3 chars long</td>
              </tr>
              <tr>
                <td>global_expire<span class="help-article__red">*</span></td>
                <td>When to remove players after latest add</td>
                <td>
                  <div class="help-article__type help-article__type--time">
                    Time
                  </div>
                </td>
                <td>3 hours to 24 hours</td>
              </tr>
              <tr>
                <td>report_expire</td>
                <td>When pickups are not rateable anymore</td>
                <td>
                  <div class="help-article__type help-article__type--time">
                    Time
                  </div>
                </td>
                <td>30 minutes to 24 hours</td>
              </tr>
              <tr>
                <td>trust_time<span class="help-article__red">*</span></td>
                <td>Time for server join add restriction</td>
                <td>
                  <div class="help-article__type help-article__type--time">
                    Time
                  </div>
                </td>
                <td>15 minutes to 14 days</td>
              </tr>
              <tr>
                <td>explicit_trust</td>
                <td>Only allow known players to add</td>
                <td>
                  <div class="help-article__type help-article__type--bool">
                    Boolean
                  </div>
                </td>
                <td>true or false</td>
              </tr>
              <tr>
                <td>allowlist<span class="help-article__red">*</span></td>
                <td>Only allows players with this role to add</td>
                <td>
                  <div class="help-article__type help-article__type--mention">
                    Role
                  </div>
                </td>
                <td>Role mention, id or name</td>
              </tr>
              <tr>
                <td>denylist<span class="help-article__red">*</span></td>
                <td>Disallow players with this role to add</td>
                <td>
                  <div class="help-article__type help-article__type--mention">
                    Role
                  </div>
                </td>
                <td>Role mention, id or name</td>
              </tr>
              <tr>
                <td>pickup_player<span class="help-article__red">*</span></td>
                <td>Role every pickup player gets assigned when playing a pickup</td>
                <td>
                  <div class="help-article__type help-article__type--mention">
                    Role
                  </div>
                </td>
                <td>Role mention, id or name</td>
              </tr>
              <tr>
                <td>promotion_delay</td>
                <td>Time interval pickups can be promoted / a sub called</td>
                <td>
                  <div class="help-article__type help-article__type--time">
                    Time
                  </div>
                </td>
                <td>5 minutes to 12 hours</td>
              </tr>
              <tr>
                <td>server<span class="help-article__red">*</span></td>
                <td>Default pickup server</td>
                <td>
                  <div class="help-article__type help-article__type--string">
                    String
                  </div>
                </td>
                <td>Valid stored server</td>
              </tr>
              <tr>
                <td>start_message</td>
                <td>Message which will be displayed on pickup starts</td>
                <td>
                  <div class="help-article__type help-article__type--string">
                    String
                  </div>
                </td>
                <td>1 to 200 chars long</td>
              </tr>
              <tr>
                <td>sub_message</td>
                <td>Message which will be displayed on sub call</td>
                <td>
                  <div class="help-article__type help-article__type--string">
                    String
                  </div>
                </td>
                <td>1 to 200 chars long</td>
              </tr>
              <tr>
                <td>notify_message</td>
                <td>
                  Message which will be sent to players with notify enabled
                </td>
                <td>
                  <div class="help-article__type help-article__type--string">
                    String
                  </div>
                </td>
                <td>1 to 200 chars long</td>
              </tr>
              <tr>
                <td>iteration_time</td>
                <td>Time interval between afk check / picking iterations</td>
                <td>
                  <div class="help-article__type help-article__type--time">
                    Time
                  </div>
                </td>
                <td>10 seconds to 5 minutes</td>
              </tr>
              <tr>
                <td>afk_time</td>
                <td>
                  Time until a player is stored as AFK without chat activity
                </td>
                <td>
                  <div class="help-article__type help-article__type--time">
                    Time
                  </div>
                </td>
                <td>5 minutes to 6 hours</td>
              </tr>
              <tr>
                <td>afk_check_iterations</td>
                <td>Iterations until the afk check aborts</td>
                <td>
                  <div class="help-article__type help-article__type--number">
                    Number
                  </div>
                </td>
                <td>1 to 5</td>
              </tr>
              <tr>
                <td>picking_iterations</td>
                <td>Iterations until the picking phase aborts</td>
                <td>
                  <div class="help-article__type help-article__type--number">
                    Number
                  </div>
                </td>
                <td>1 to 5</td>
              </tr>
              <tr>
                <td>map_vote_iterations</td>
                <td>Iterations until the map vote is done</td>
                <td>
                  <div class="help-article__type help-article__type--number">
                    Number
                  </div>
                </td>
                <td>1 to 5</td>
              </tr>
              <tr>
                <td>captain_selection_iterations</td>
                <td>Iterations until manual captain selection is doen</td>
                <td>
                  <div class="help-article__type help-article__type--number">
                    Number
                  </div>
                </td>
                <td>1 to 5</td>
              </tr>
              <tr>
                <td>max_avg_elo_variance</td>
                <td>
                  Max average elo variance for the autopick mode to use elo
                  picking mode
                </td>
                <td>
                  <div class="help-article__type help-article__type--number">
                    Number
                  </div>
                </td>
                <td>100 to 830</td>
              </tr>
              <tr>
                <td>max_rank_rating_cap</td>
                <td>The rating required to reach the highest rank</td>
                <td>
                  <div class="help-article__type help-article__type--number">
                    Number
                  </div>
                </td>
                <td>1000 to 5000</td>
              </tr>
              <tr>
                <td>warn_streaks</td>
                <td>Highest possible warn streak</td>
                <td>
                  <div class="help-article__type help-article__type--number">
                    Number
                  </div>
                </td>
                <td>1 to 10</td>
              </tr>
              <tr>
                <td>warn_streak_expiration</td>
                <td>Time until a warn streak expires</td>
                <td>
                  <div class="help-article__type help-article__type--time">
                    Time
                  </div>
                </td>
                <td>1 day to 30 days</td>
              </tr>
              <tr>
                <td>warn_expiration</td>
                <td>Time until a warn expires</td>
                <td>
                  <div class="help-article__type help-article__type--time">
                    Time
                  </div>
                </td>
                <td>2 hours to 14 days</td>
              </tr>
              <tr>
                <td>warn_bantime</td>
                <td>Time until a warn ban expires</td>
                <td>
                  <div class="help-article__type help-article__type--time">
                    Time
                  </div>
                </td>
                <td>1 hour to 7 days</td>
              </tr>
              <tr>
                <td>warn_bantime_multiplier</td>
                <td>Multiplier of the warn bantime on streaks</td>
                <td>
                  <div class="help-article__type help-article__type--number">
                    Number
                  </div>
                </td>
                <td>1 to 5</td>
              </tr>
              <tr>
                <td>warns_until_ban</td>
                <td>Warns until the player gets banned</td>
                <td>
                  <div class="help-article__type help-article__type--number">
                    Number
                  </div>
                </td>
                <td>2 to 10</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="help-article__type help-article__type--time">Time</div>
        - Time string (1s, 1m, 1h, 1d, 1w) (seconds, minutes, hours, days,
        weeks)
        <p class="margin-top-small">
          <span class="help-article__red">*</span>Can be none to disable / clear
        </p>
        <p>
          Variables which are used for the
          <base-link
            :to="{ name: 'Command', params: { command: 'modify_bot' } }"
            mode="bold"
            >modify_bot</base-link
          >
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
  width: 70vw;
}
</style>